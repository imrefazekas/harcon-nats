# harcon-nats
NATS.IO transport layer ("Barrel") plugin for [harcon](https://github.com/imrefazekas/harcon).

Zero configuration scaling: this transport layer supports infinite horizontal scaling for harcon microservices without any configuration. All service discovery and balancing logic is provided by this package.

## Installation

```javascript
npm install harcon harcon-nats --save
```


## Usage

```javascript
let Harcon = require('harcon')
let Nats = require('harcon-nats')

let natsConfig = {
	connectURL: 'amqp://localhost',
	socketType: 'PUBSUB', // 'PUSHPULL' to be used for PUSH/PULL socket type
	timeout: 0
}
let harcon = new Harcon( { Barrel: Nats.Barrel, barrel: natsConfig } )
```

Should the recipients be not available or fail to meet the timeframe defined by the attribute 'timeout', [harcon](https://github.com/imrefazekas/harcon) will call the callbacks of the given messages with an error.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
