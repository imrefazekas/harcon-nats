const faker = require('faker')

let loads = []
for (let i = 0; i < 100000; ++i)
	loads.push( {
		name: faker.name.findName(),
		email: faker.internet.email(),
		address: faker.address.streetAddress( '###' ) + ' ' + faker.address.city() + ' ' + faker.address.county() + ' ' + faker.address.country()
	} )

module.exports = {
	name: 'Peter',
	load: async function ( ) {
		console.log('Peter is loading...')
		return loads
	}
}
