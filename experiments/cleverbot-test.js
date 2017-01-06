var Cleverbot = require('cleverbot-node')
var cleverbot = new Cleverbot

Cleverbot.prepare(() => {})

setTimeout(()=>{
	cleverbot.write("How big is a blue whale?", function (response) {
	     console.log(response.message)
	})
}, 2000)

setTimeout(()=>{
	cleverbot.write("Are you a person?", function (response) {
	     console.log(response.message)
	})
}, 8000)
