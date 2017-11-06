let NATS = require('nats')

try {
	let nats = NATS.connect( {
		'url': 'nats://localhost:4222'
	} )

	nats.on('error', function (err) {
		console.log(err)
	})

	nats.on('connect', function (nc) {
		console.log('connected')
	})

	nats.on('disconnect', function () {
		console.log('disconnect')
	})

	nats.on('reconnecting', function () {
		console.log('reconnecting')
	})

	nats.on('reconnect', function (nc) {
		console.log('reconnect')
	})

	nats.on('close', function () {
		console.log('close')
	})

	setTimeout( () => {
		nats.close()
	}, 5000 )
} catch (err) {
	console.error( err )
}
