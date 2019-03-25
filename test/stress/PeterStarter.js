let harconName = 'HarconSys'

let Harcon = require('harcon')
let Nats = require('../../lib/Nats')

let Proback = require('proback.js')

let Logger = require('../PinoLogger')
let logger = Logger.createPinoLogger( { file: 'mochatest.log', level: 'info' } )

let inflicter
async function init () {
	try {
		let harcon = new Harcon( {
			name: harconName,
			Barrel: Nats.Barrel,
			barrel: { 'url': 'nats://localhost:4222' },
			logger: logger, idLength: 32,
			blower: { commTimeout: 2500, tolerates: ['Anna.questioning', 'Peter.load'] },
			mortar: { enabled: false, liveReload: false, liveReloadTimeout: 2000 }
		} )

		inflicter = await harcon.init()

		await inflicter.inflicterEntity.deploy( require('./Peter') )

		await Proback.timeout(2000)
	} catch (err) {
		console.error(err)
	}
}

init().then( () => {
	console.log('\n\Peter -----------------------\n\n')
} )
