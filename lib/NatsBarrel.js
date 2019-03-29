let _ = require('isa.js')
let NATS = require('nats')

let Harcon = require('harcon')
let Barrel = Harcon.Barrel
let Communication = Harcon.Communication

let DIVISION_REPORTS = 'harcon_division_reports'

let Proback = require('proback.js')

function NatsBarrel ( ) { }
NatsBarrel.prototype = new Barrel()
let natsbarrel = NatsBarrel.prototype

let SEPARATOR = '.'

let errorAttribs = [ 'code', 'message', 'errorCode', 'id', 'reason', 'params' ]
function printError (err) {
	let res = {}
	for (let attrib of errorAttribs)
		if ( err[ attrib ] )
			res[ attrib ] = err[attrib]

	res.message = err.message || err.toString()
	return res
}
function buildError (obj) {
	let error = new Error('')
	for (let attrib of errorAttribs)
		if ( obj[ attrib ] )
			error[ attrib ] = obj[attrib]

	return error
}

natsbarrel.errorAttributes = function ( _errorAttribs ) {
	errorAttribs = _errorAttribs || []
}
natsbarrel.randomNodeID = function ( valve, division, entityName ) {
	if ( _.isNumber( valve ) ) return valve

	if ( !this.presences || !this.presences[division] || !this.presences[division][entityName] )
		return null

	let ids = Object.keys( this.presences[division][entityName] )
	let id = ids[ Math.floor( Math.random( ) * ids.length ) ]
	return id
}

natsbarrel.innerCreateIn = function ( division, entityName, nodeID, handler ) {
	let self = this

	return new Promise( (resolve, reject) => {
		try {
			let socketName = division + SEPARATOR + entityName + (nodeID ? SEPARATOR + nodeID : nodeID)
			self.nats.subscribe( socketName, handler )

			self.ins[division][entityName] = { timestamp: Date.now() }

			self.logger.harconlog( null, 'NATS SUBSCRIBE is made.', { division: division, entity: entityName }, 'info' )

			resolve( 'ok' )
		} catch (err) { reject( err ) }
	} )
}

natsbarrel.commPacket = async function ( comm ) {
	let self = this

	if ( !comm.comm ) return

	let reComm = Communication.importCommunication( comm.comm )
	let reResComm = comm.response ? (comm.responseComms.length > 0 ? Communication.importCommunication( comm.responseComms[0] ) : reComm.twist( self.systemFirestarter.name, comm.err ) ) : null

	let interested = (!reResComm && self.matching( reComm ).length !== 0) || (reResComm && self.matchingResponse( reResComm ).length !== 0)
	if ( !interested ) return false
	return await self.innerProcessNats( comm )
}

natsbarrel.createDivisionIn = function ( division, force ) {
	let self = this
	if ( !force && self.ins[division][DIVISION_REPORTS] ) return 'done'
	return self.innerCreateIn( division, DIVISION_REPORTS, '', async function ( message ) {
		try {
			let status = JSON.parse( message )
			if ( status.comm )
				return await self.commPacket( status )

			if ( !status.divisions && (!status.division || !status.entity || !status.nodeID) ) return

			if ( status.divisions ) {
				for (let division of status.divisions)
					await self.extendedNewDivision( division )
				return 'ok'
			}

			if ( !self.presences[ status.division ] )
				self.presences[ status.division ] = {}
			if ( !self.presences[ status.division ][ status.entity ] )
				self.presences[ status.division ][ status.entity ] = {}

			self.presences[ status.division ][ status.entity ][ status.nodeID ] = { timestamp: Date.now(), warper: self.warper.inpose( status.warper ) }
		} catch (err) { self.logger.harconlog( err ) }
	}, true )
}

natsbarrel.createEntityIn = function ( division, entityName, force ) {
	let self = this
	if ( !force && self.ins[division][entityName] ) return 'done'
	return self.innerCreateIn( division, entityName, self.nodeID, async function ( message ) {
		try {
			await self.commPacket( JSON.parse( message ) )
		} catch (err) { self.logger.harconlog( err ) }
	}, false )
}

natsbarrel.extendedInit = async function ( config ) {
	let self = this

	self.logger.harconlog( null, 'configuring NATS Barrel.', {}, 'info' )

	self.messages = {}
	self.ins = {}

	self.reporterInterval = config.reporterInterval || 2000
	self.reporter = setInterval( () => { self.reportStatus() }, self.reporterInterval )

	self.presences = {}
	self.warper.referenceMatrix( self.presences )

	self.keeperInterval = config.keeperInterval || 3000
	self.keeper = setInterval( () => { self.checkPresence() }, self.keeperInterval )

	self.config = config
	if ( !self.maxReconnectAttempts ) self.maxReconnectAttempts = -1
	if ( !self.reconnectTimeWait ) self.reconnectTimeWait = 250

	await self.connect( )
	return 'ok'
}

natsbarrel.cleanupMessages = function () {
	let self = this

	let time = Date.now()
	for ( let key of Object.keys( self.messages ) ) {
		if ( time - self.messages[key].timestamp > self.timeout ) {
			let callbackFn = self.messages[key].callback
			delete self.messages[ key ]
			callbackFn( new Error('Response timeout') )
		}
	}
}

natsbarrel.extendedNewDivision = async function ( division ) {
	let self = this

	if ( !self.ins[division] ) self.ins[division] = {}
	if ( !self.ins[division][ DIVISION_REPORTS ] )
		await self.createDivisionIn( division )

	if (!this.presences[ division ]) this.presences[ division ] = {}
	this.presences[ division ]['*'] = { warper: this.warper.inpose( this.warper.expose() ) }

	return 'ok'
}
natsbarrel.extendedRemoveEntity = async function ( division, context, name ) {
	return 'ok'
}
natsbarrel.extendedNewEntity = async function ( division, context, name ) {
	var self = this

	if ( !self.ins[division] ) self.ins[division] = {}
	if (context && !self.ins[division][context] )
		await self.createEntityIn( division, context )
	if (!self.ins[division][name] )
		await self.createEntityIn( division, name )
	return 'ok'
}

natsbarrel.innerProcessNats = async function ( comm ) {
	let self = this

	self.logger.harconlog( null, 'Packet received', comm, 'trace' )

	let realComm = Communication.importCommunication( comm.comm )

	if ( !comm.response ) {
		if ( comm.callback )
			realComm.callback = function () { }
		await self.appease( realComm )
	} else {
		if ( self.messages[ comm.id ] ) {
			realComm.callback = self.messages[ comm.id ].callback
			delete self.messages[ comm.id ]
		}
		let responses = comm.responseComms.map(function (c) { return Communication.importCommunication( c ) })
		await self.appease( realComm, comm.err ? buildError(comm.err) : null, responses )
	}
	return 'ok'
}

natsbarrel.intoxicateMessage = async function ( comm ) {
	var self = this

	if ( self.isSystemEvent( comm.event ) )
		return this.appease( comm )

	if ( self.messages[ comm.id ] )
		throw new Error('Duplicate message delivery:' + comm.id )

	self.logger.harconlog( null, 'Packet sending', comm, 'trace' )

	if ( comm.callback )
		self.messages[ comm.id ] = { callback: comm.callback, timestamp: Date.now() }

	let entityName = comm.event.substring(0, comm.event.lastIndexOf( SEPARATOR ) )
	let packet = JSON.stringify( { id: comm.id, comm: comm, callback: !!comm.callback } )
	let nodeNO = self.randomNodeID( comm.valve, comm.division, entityName )

	self.nats.publish( comm.division + SEPARATOR + entityName + (nodeNO ? SEPARATOR + nodeNO : ''), packet )

	return 'ok'
}
natsbarrel.intoxicateAnswer = async function ( comm, err, responseComms ) {
	var self = this

	if ( !comm.expose && self.isSystemEvent( comm.event ) )
		return this.appease( comm, err, responseComms )

	let error = err ? printError(err) : null
	self.logger.harconlog( null, 'Packet sending', {comm: comm, err: error, responseComms: responseComms}, 'trace' )

	let entityName = comm.source // event.substring(0, comm.event.indexOf('.') )
	let packet = JSON.stringify( { id: comm.id, comm: comm, err: error, response: true, responseComms: responseComms || [] } )
	let nodeNO = comm.sourceNodeID || self.randomNodeID( comm.valve, comm.sourceDivision, entityName )

	self.nats.publish( comm.sourceDivision + SEPARATOR + entityName + (nodeNO ? (SEPARATOR + nodeNO) : ''), packet )

	return 'ok'
}

natsbarrel.checkPresence = function ( ) {
	let self = this

	let timestamp = Date.now()
	Object.keys(self.presences).forEach( function (division) {
		Object.keys(self.presences[division]).forEach( function (entity) {
			Object.keys(self.presences[division][entity]).forEach( function (nodeID) {
				if ( self.presences[division][entity][nodeID].timestamp <= timestamp - self.keeperInterval )
					delete self.presences[division][entity][nodeID]
			} )
		} )
	} )
}

natsbarrel.reportStatus = function ( ) {
	let self = this

	try {
		let divisions = Object.keys(self.ins)

		self.nats.publish( self.division + SEPARATOR + DIVISION_REPORTS, JSON.stringify( {
			divisions: divisions
		} ) )

		divisions.forEach( function (division) {
			Object.keys(self.ins[division]).forEach( function (entity) {
				self.nats.publish( division + SEPARATOR + DIVISION_REPORTS, JSON.stringify( {
					division: division, entity: entity, nodeID: self.nodeID, warper: self.warper.expose()
				} ) )
			} )
		} )
	} catch ( err ) { self.logger.harconlog( err ) }
}

natsbarrel.clearReporter = function ( ) {
	if (this.reporter) {
		clearInterval( this.reporter )
		this.reporter = null
	}
}

natsbarrel.clearKeeper = function ( ) {
	if (this.keeper) {
		clearInterval( this.keeper )
		this.keeper = null
	}
}

natsbarrel.clearClearer = function ( ) {
	if ( this.cleaner ) {
		clearInterval( this.cleaner )
		this.cleaner = null
	}
}

natsbarrel.connect = function ( ) {
	let self = this

	return new Promise( (resolve, reject) => {
		self.logger.harconlog( null, 'Connecting to NATS:', self.config.url, 'info' )

		try {
			self.nats = NATS.connect( self.config )

			self.nats.on('connect', function (nc) {
				self.logger.harconlog( null, 'NATS connection is made', { }, 'warn' )
				self.setupDivisions( )
					.then( () => { resolve('ok') } )
					.catch( reject )
			})
			self.nats.on('error', (err) => {
				self.logger.harconlog( err )
			} )
			self.nats.on('close', () => {
				self.logger.harconlog( null, 'NATS connection closed')
			} )
			self.nats.on('disconnect', function () {
				self.logger.harconlog( null, 'NATS disconnected')
			})

			self.nats.on('reconnecting', function () {
				self.logger.harconlog( null, 'NATS reconnecting...')
			})

			self.nats.on('reconnect', function (nc) {
				self.logger.harconlog( null, 'NATS reconnected')
			})

			self.clearClearer()
			if ( self.timeout > 0 ) {
				self.cleaner = setInterval( function () {
					self.cleanupMessages()
				}, self.timeout )
			}
		} catch (err) { reject(err) }
	} )
}

natsbarrel.setupDivisions = async function ( ) {
	let self = this

	for ( let division of Object.keys(self.ins) ) {
		await self.createDivisionIn( division, true )
		for ( let entity of Object.keys(self.ins[division]) )
			await self.createEntityIn( division, entity, true )
	}
	return 'ok'
}

natsbarrel.extendedClose = function ( ) {
	var self = this
	return new Promise( async (resolve, reject) => {
		self.finalised = true
		self.clearReporter()
		self.clearKeeper()
		self.clearClearer()
		try {
			if ( self.nats ) {
				self.nats.close()
			}
			resolve('ok')
		} catch (err) {
			reject(err)
		}
	} )
}

module.exports = NatsBarrel
