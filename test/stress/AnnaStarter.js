let harconName = 'HarconSys'

let Harcon = require('harcon')
let Nats = require('../../lib/Nats')

let Proback = require('proback.js')

let Logger = require('../PinoLogger')
let logger = Logger.createPinoLogger( { file: 'mochatest.log', level: 'info' } )

let Clerobee = require('clerobee')
let clerobee = new Clerobee(16)

let inflicter
async function init () {
	try {
		let harcon = new Harcon( {
			name: harconName,
			Barrel: Nats.Barrel,
			barrel: { 'url': 'nats://localhost:4222' },
			logger: logger, idLength: 32,
			blower: { commTimeout: 1500, tolerates: [ ] },
			mortar: { enabled: false, liveReload: false, liveReloadTimeout: 2000 }
		} )

		inflicter = await harcon.init()

		await inflicter.inflicterEntity.deploy( require('./Anna') )

		await Proback.timeout(2000)
	} catch (err) {
		console.error(err)
	}
}

init().then( () => {
	console.log('\n\n-----------------------\n\n')

	return Promise.all( [
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' ),
		inflicter.request( clerobee.generate(), null, '', 'Hanna.greetings' )
	] )
} )
