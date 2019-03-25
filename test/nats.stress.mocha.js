const assert = require('assert')

let chai = require('chai')
let should = chai.should()
let expect = chai.expect

// Requires harcon. In your app the form 'require('harcon')' should be used
let Harcon = require('harcon')
let Nats = require('../lib/Nats')

let Logger = require('./PinoLogger')

let Clerobee = require('clerobee')
let clerobee = new Clerobee(16)

let Proback = require('proback.js')

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, ' .... reason:', reason)
})

let harconName = 'HarconSys'
describe('harcon', function () {
	let inflicter

	before( async function () {
		this.timeout(10000)

		let logger = Logger.createPinoLogger( { file: 'mochatest.log', level: 'info' } )
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

			await inflicter.inflicterEntity.deploy( require('./stress/Peter') )

			await Proback.timeout(2000)

			console.log('\n\n-----------------------\n\n')
			assert.ok( 'Harcon initiated...' )
		} catch (err) {
			console.error(err)
			assert.fail( err )
		}
	})

	describe('simple messages', function () {
		this.timeout( 120000 )

		it('Alize dormir', async function () {
			await inflicter.request( clerobee.generate(), null, '', 'Peter.load' )
			return 'ok'
		})
	})

	after(async function () {
		if (inflicter)
			await inflicter.close( )
	})
})
