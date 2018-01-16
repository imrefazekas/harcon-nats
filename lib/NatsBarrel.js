let _ = require('isa.js')
let NATS = require('nats')

let Harcon = require('harcon')
let Barrel = Harcon.Barrel
let Communication = Harcon.Communication

let DIVISION_REPORTS = 'harcon_division_reports'

function NatsBarrel ( ) { }
NatsBarrel.prototype = new Barrel()
let natsbarrel = NatsBarrel.prototype

let SEPARATOR = '.'

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

natsbarrel.createDivisionIn = function ( division ) {
	let self = this
	if ( self.ins[division][DIVISION_REPORTS] ) return 'done'
	return self.innerCreateIn( division, DIVISION_REPORTS, '', async function ( message ) {
		try {
			let status = JSON.parse( message )
			if ( status.comm )
				return await self.commPacket( status )

			if (!status.domain || !status.entity || !status.nodeID ) return

			if ( !self.presences[ status.domain ] )
				self.presences[ status.domain ] = {}
			if ( !self.presences[ status.domain ][ status.entity ] )
				self.presences[ status.domain ][ status.entity ] = {}

			self.presences[ status.domain ][ status.entity ][ status.nodeID ] = { timestamp: Date.now(), warper: self.warper.inpose( status.warper ) }
		} catch (err) { self.logger.harconlog( err ) }
	}, true )
}

natsbarrel.createEntityIn = function ( division, entityName ) {
	let self = this
	if ( self.ins[division][entityName] ) return 'done'
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

	self.logger.harconlog( null, 'Received from bus...', comm, 'trace' )

	let realComm = Communication.importCommunication( comm.comm )

	if ( !comm.response ) {
		if ( comm.callback )
			realComm.callback = function () { }
		self.logger.harconlog( null, 'Request received from bus...', realComm, 'trace' )
		await self.appease( realComm )
	} else {
		if ( self.messages[ comm.id ] ) {
			realComm.callback = self.messages[ comm.id ].callback
			delete self.messages[ comm.id ]
		}
		let responses = comm.responseComms.map(function (c) { return Communication.importCommunication( c ) })
		await self.appease( realComm, comm.err ? new Error(comm.err) : null, responses )
	}
	return 'ok'
}

natsbarrel.intoxicateMessage = async function ( comm ) {
	var self = this

	if ( self.isSystemEvent( comm.event ) )
		return this.appease( comm )

	self.logger.harconlog( null, 'Intoxicating to bus...', comm, 'trace' )

	if ( self.messages[ comm.id ] )
		throw new Error('Duplicate message delivery:' + comm.id )

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

	self.logger.harconlog( null, 'Intoxicating to bus...', {comm: comm, err: err ? err.message : null, responseComms: responseComms}, 'trace' )

	let entityName = comm.source // event.substring(0, comm.event.indexOf('.') )
	let packet = JSON.stringify( { id: comm.id, comm: comm, err: err ? err.message : null, response: true, responseComms: responseComms || [] } )
	let nodeNO = comm.sourceNodeID || self.randomNodeID( comm.valve, comm.sourceDivision, entityName )

	self.nats.publish( comm.sourceDivision + SEPARATOR + entityName + (nodeNO ? (SEPARATOR + nodeNO) : ''), packet )

	return 'ok'
}

natsbarrel.checkPresence = function ( ) {
	let self = this

	let timestamp = Date.now()
	Object.keys(self.presences).forEach( function (domain) {
		Object.keys(self.presences[domain]).forEach( function (entity) {
			Object.keys(self.presences[domain][entity]).forEach( function (nodeID) {
				if ( self.presences[domain][entity][nodeID].timestamp <= timestamp - self.keeperInterval )
					delete self.presences[domain][entity][nodeID]
			} )
		} )
	} )
}

natsbarrel.reportStatus = function ( ) {
	let self = this

	try {
		Object.keys(self.ins).forEach( function (domain) {
			Object.keys(self.ins[domain]).forEach( function (entity) {
				self.nats.publish( domain + SEPARATOR + DIVISION_REPORTS, JSON.stringify( {
					domain: domain, entity: entity, nodeID: self.nodeID, warper: self.warper.expose()
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
		self.logger.harconlog( null, 'connecting to NATS...', self.config, 'info' )

		try {
			self.nats = NATS.connect( self.config )

			self.nats.on('connect', function (nc) {
				self.logger.harconlog( null, 'NATS connection is made.', { }, 'warn' )
				self.setupDomains( )
					.then( () => { resolve('ok') } )
					.catch( reject )
			})
			self.nats.on('error', (err) => {
				self.logger.harconlog( err )
				self.reconnect()
					.catch( self.logger.harconlog )
			} )
			self.nats.on('close', () => {
				self.reconnect()
					.catch( self.logger.harconlog )
			} )

			self.clearClearer()
			if ( self.timeout > 0 ) {
				self.cleaner = setInterval( function () {
					self.cleanupMessages()
				}, self.timeout )
			}
		} catch (err) { reject(err) }
	} )
}

natsbarrel.reconnect = function ( ) {
	let self = this

	return new Promise( async (resolve, reject) => {
		if (self.finalised) return resolve('ok')

		try {
			await Promise.timeout( self.reconnectionTimeout )
			self.logger.harconlog( null, 'Reconnecting...', self.connectURL, 'warn' )

			await self.connect()
			self.reconnectionTimeout = self.reconnectionTimeout * 2
			if ( self.reconnectionTimeout > self.reconnectionMaxTimeout )
				self.reconnectionTimeout = self.reconnectionMaxTimeout
			resolve('ok')
		} catch (err) { reject(err) }
	} )
}

natsbarrel.setupDomains = async function ( ) {
	let self = this

	for ( let domain of Object.keys(self.ins) ) {
		await self.createDivisionIn( domain )
		for ( let entity of Object.keys(self.ins[domain]) )
			await self.createEntityIn( domain, entity )
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
			if ( self.nats )
				self.nats.close()
			resolve('ok')
		} catch (err) {
			reject(err)
		}
	} )
}

module.exports = NatsBarrel