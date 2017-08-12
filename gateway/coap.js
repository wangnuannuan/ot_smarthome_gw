/* ------------------------------------------
LICENSE

 * \version 
 * \date    2017-8-12
 * \author  Xiangcai Huang
 * \brief	the functions about the 
 	OpenThread-CoAP-Based Server and Client.
--------------------------------------------- */
const coap    = require('coap')
    , config  = require('./config').coap
    , coapServer  = coap.createServer({ type: 'udp6' })

function serverStart(handleMessage)
{
	coapServer.listen(config.gwPort, config.localAddr, function() {
		console.log('Coap: Listening at port: ' + config.gwPort)
	})

	// receive PUT message from Thread Nodes
	coapServer.on('request', handleMessage)
}

// send PUT message to Thread Nodes
function sendToNode(nodeAddr, nodePort, url, value)
{
	var req = coap.request({
		  host: nodeAddr
		, port: nodePort
		, method: 'PUT'
		, pathname: url // url for PUT request
	})

	console.log('GW: Send PUT request to [' + nodeAddr + '].')

	req.on('response', function(res) {
		console.log('GW: Send successfully.')
		res.pipe(process.stdout)
	})

	req.end(value) // add payload: value to PUT message
}

module.exports.serverStart = serverStart
module.exports.sendToNode  = sendToNode