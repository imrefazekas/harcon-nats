module.exports = {
	name: 'Chris',
	auditor: true,
	init: async function (config) {
		let self = this
		self.config = config
		/*
		this.setInterval( async () => {
			console.log( '>>>>>>>>>>>', this.name, await self.harconEntities() )
		}, 2000 )

		this.setInterval( async () => {
			console.log( '--------', await self.request( null, null, 'HarconSys.factory', 'Phil.echo', 'Helloka!' ) )
		}, 10000 )
		*/
	},
	echo: async function ( message, terms ) {
		return message
	},
	dormir: async function ( terms ) {
		return 'Oui!'
	}
}
