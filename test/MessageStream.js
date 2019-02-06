let path = require('path')

// Requires harcon. In your app the form 'require('harcon')' should be used
let Harcon = require('harcon')
let Nats = require('../lib/Nats')

let Logger = require('./PinoLogger')

let Clerobee = require('clerobee')
let clerobee = new Clerobee(16)

let Proback = require('proback.js')

let inflicter

async function start () {
	let logger = Logger.createPinoLogger( { file: 'mochatest.log', level: 'debug' } )

	let harcon = new Harcon( {
		name: 'BlockNetworks',
		Barrel: Nats.Barrel,
		barrel: { 'url': 'nats://natsio.local.blockben.net:4222' },
		logger: logger,
		idLength: 32,
		blower: { commTimeout: 1500 },
		mortar: { enabled: false }
	} )
	inflicter = await harcon.init()

	await inflicter.inflicterEntity.deploy( {
		name: 'PMF',
		init: async function (config) {
			this.config = config
			console.log('PMF made....')
		},
		referencePricesPastDays: async function (terms) {
			console.log( '.....', terms )
			return [ 1, 1.1, 2, 2.2, 3.3, 4.4 ]
		}
	} )

	inflicter = await harcon.init()
}

start().catch( console.error )
