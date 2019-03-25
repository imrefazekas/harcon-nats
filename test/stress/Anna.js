let Proback = require('proback.js')
module.exports = {
	name: 'Anna',
	questioning: async function ( terms ) {
		try { await terms.request( 'Peter.load' ) } catch (err) { console.error(err) }
		return 'ok'
	},
	silent: async function ( ) {
		await Proback.timeout( 1900 )
		return 'ssss'
	}
}
