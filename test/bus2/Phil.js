module.exports = {
	name: 'Phil',
	init: async function (config) {
		let self = this
		self.config = config
		/*
		this.setInterval( async () => {
			console.log( '??????????', this.name, await self.harconEntities() )
		}, 2000 )
		*/
	},
	echo: async function ( message, terms, ignite ) {
		return message
	},
	dormir: async function ( terms, ignite ) {
		return await ignite( 'Chris.dormir' )
	}
}
