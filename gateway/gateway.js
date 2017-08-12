/* ------------------------------------------
LICENSE

 * \version 
 * \date    2017-8-12
 * \author  Xiangcai Huang
 * \brief	the functions about the 
	OpenThread Application Gateway.
--------------------------------------------- */
const coap    = require('./coap')
    , cfgCoap  = require('./config').coap
    , cfgObjectId  = require('./config').ObjectId
    , clUtils = require('command-node')
    , httpServer  = require('./httpServer')
    , wsServer = require('./webSocketServer')
    , utils    = require('./utils')

var   stateNew = require('./state').stateNew
    , state    = require('./state').state


// must initialize the stateNew or it happen error
function stateInit()
{
	stateNew = {
		'frontdoor':{
			"3311":{"0":{"5850": false}} // 'lock_sta':
		},
		'livingroom':{
			"3311":{"0":{"5850": false}} // 'light_sta':
		}
	}
}

// receive PUT message from Thread Nodes
function coapMessageHandle(req, res)
{
	var method  = req.method.toString()
	var url     = req.url.split('/')[1].toString()
	var value   = req.payload.toString()

	console.log('\nRequest received:')
	console.log('\t method:  ' + method)
	console.log('\t url:     ' + url)
	console.log('\t payload: ' + value)

	if (method === 'PUT') {
		switch(url){
		case cfgCoap.lockSta:
			sendToUI(cfgCoap.nodeFrontdoor, cfgCoap.lockSta, value)
			break
		case cfgCoap.lightSta:
			sendToUI(cfgCoap.nodeLivingroom, cfgCoap.lightSta, value)
			break
		default:
			console.error('Err: Bad url.\r\n')
			break
		}
	}
	res.end('GW: Received.') // send response to client
}

function deltaFromUI(thingName, stateObject)
{
	var stateDelta = stateObject.state, newValue, endpoint, oId, iId, rId

	for (endpoint in stateDelta) {
	for (oId in stateDelta[endpoint]) {
	for (iId in stateDelta[endpoint][oId]) {
	for (rId in stateDelta[endpoint][oId][iId]) {
		// get new value from delta message
		newValue = stateDelta[endpoint][oId][iId][rId]

		if (!stateNew[endpoint]) {
			console.error('GW: Can not find this Node-%s in stateNew.', endpoint)
			return
		}

		// update stateNew
		stateNew[endpoint][oId][iId][rId] = newValue

		endpoint = endpoint.toString()
		oId = oId.toString()
		iId = iId.toString()
		rId = rId.toString()
		newValue = newValue.toString()

		// must send "1"/"0" to node ,not "true" or "false"
		if (newValue == "true") {
			newValue = "1"
		} else {
			newValue = "0"
		}

		// send state changed to Node
		console.log("GW: Send state changed to Node.")
		var url

		if (endpoint == cfgCoap.nodeFrontdoor) {
			switch (oId) {
			case cfgObjectId.oIdLight:
				url = cfgCoap.lockSta
				coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, url, newValue)
				break
			default:
				console.error('Err: Bad Object oId')
				return
			}
			// coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, url, newValue)
		} else if (endpoint == cfgCoap.nodeLivingroom) {
			switch (oId) {
			case cfgObjectId.oIdLight:
				url = cfgCoap.lightSta
				// coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, url, newValue)
				break
			default:
				console.error('Err: Bad Object oId')
				return
			}
			coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, url, newValue)
		} else {
			console.error('Err: Bad Object endpoint.')
			return
		}
	}}}}
}

// receive PUT message from Web UI
function WSMessageHandle(message)
{
	if (message.type === 'utf8') {
		var msg = message.utf8Data
		console.log("\n\nGW: Received package: " + msg)

		//get package "{}" means the UI is start running, need to get all state - stateNew
		if (msg == "{}") {
			wsServer.send(stateNew)          //send stateNew to UI
			state = utils.deepCopy(stateNew) //update state
			console.log("GW: UI is start running.")
		} else {
			var stateNew = JSON.parse(msg)
			for (var key in stateNew) {
				//get package "desired" means the UI has changed
				if (key == "desired") {
					console.log("GW: UI status changed.")
					//deal with the delta message from UI
					deltaFromUI(null, {state: stateNew[key]})
				} else {
					console.error("GW: Can't recieved reported.")
				}
			}
		}
	} else {
		console.error("GW: Unknow message type.")
	}
}

// send state changed to UI
function sendToUI(nodeName, url, val)
{
	var endpoint = nodeName
	var oId, iId, rId

	// remap coap url to Object Id
	switch(url){
	case cfgCoap.lockSta:
	case cfgCoap.lightSta:
		oId = cfgObjectId.oIdLight
		iId = cfgObjectId.iId
		rId = cfgObjectId.rIdLight
		break
	default:
		console.error('Err: Bad url')
	}

	if (val == cfgCoap.valOn) {
		val = true
	} else {
		val = false
	}
	stateNew[endpoint][oId][iId][rId] = val

	var stateChange = utils.getDifferent(stateNew, state)
	if (stateChange !== undefined) {
		console.log("GW: Send state changed to UI.")
		console.log("\tstate changed : " + JSON.stringify(stateChange))

		wsServer.send(stateChange)       //send to UI
		state = utils.deepCopy(stateNew) //update state
	} 
}

/******************** Commands **************************/
function cmdShowState()
{
	console.log('stateNew:')
	console.log(JSON.stringify(stateNew))
	console.log('\n')
	console.log('state:')
	console.log(JSON.stringify(state))
}

function cmdSendToNode(commands)
{
	coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, commands[0], commands[1])
}

function cmdSend1ToNode(commands)
{
	coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, cfgCoap.lockSta, cfgCoap.valOn)
}

function cmdSend2ToNode(commands)
{
	coap.sendToNode(cfgCoap.localAddr, cfgCoap.nodePort, cfgCoap.lightSta, cfgCoap.valOn)
}

const commands = {
	'show': {
		parameters: [],
		description: '\tList all the resource in state and stateNew.',
		handler: cmdShowState
	},
	's': { // s lock_sta 1/0
		parameters: ['url', 'value'],
		description: '\tSend PUT message to Node',
		handler: cmdSendToNode
	},
	's1': {
		parameters: [],
		description: '\tSend lockSta PUT message to Node',
		handler: cmdSend1ToNode
	},
	's2': {
		parameters: [],
		description: '\tSend lightSta PUT message to Node',
		handler: cmdSend2ToNode
	}
}
/******************** Commands **************************/

/********************   Main   **************************/
console.log('OT Gateway starting:')

stateInit()
coap.serverStart(coapMessageHandle)
httpServer.start()
wsServer.start(WSMessageHandle)

clUtils.initialize(commands, 'GW> ')