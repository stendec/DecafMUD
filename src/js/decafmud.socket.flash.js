/*!
 * DecafMUD v0.9.0
 * http://decafmud.kicks-ass.net
 *
 * Socket: Flash
 *
 * This allows DecafMUD to connect with sockets provided by the Adobe Flash
 * plugin. This works well on most platforms (OS X, Windows, and Linux) as
 * long as they have an up-to-date version of Flash.
 *
 * It, however, won't work on some mobile devices, such as Apple iDevices, and
 * requires a policy daemon to be running on the remote server.
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

(function(DecafMUD) {

// Flash string encoding/decoding
var encodeFS = function(str) {
		return str.replace(/\x00/g, '\uE000'); },
	decodeFS = function(str) {
		return str.replace(/\uE000/g, '\x00'); };

// Create the Flash socket interface.
var FlashSocket = function(decaf) {
	// Store Decaf for later use.
	this.decaf = decaf;
	
	// Create an ID for this flash socket.
	this.id = "DecafFlashSocket__" + ( ++ FlashSocket.last_id );
};

// Storage Stuff
FlashSocket.last_id = 0;
FlashSocket.sockets = {};

// State Variables
FlashSocket.prototype.host = undefined;
FlashSocket.prototype.port = undefined;
FlashSocket.prototype.connected = false;
FlashSocket.prototype.socket = null;
FlashSocket.prototype.ready = false;

// Prepare the socket provider for use
FlashSocket.prototype.setup = function(count) {
	// Ensure that we've loaded swfobject and attempt to create a Flash socket.
	// First, disable the default timer since this could take longer than 2.5
	// seconds.
	clearTimeout(this.decaf.timer);
	var sock = this;
	
	// If this is the first time running the setup function, debug that the
	// socket is loading.
	if ( count === undefined ) { count = 0;
		this.decaf.debugString('Loading Flash socket support...'); }
	
	if ( window.swfobject === undefined ) {
		if ( ! count ) {
			this.decaf.loadScript('swfobject.js'); }
		
		if ( count < 100 ) {
			this.decaf.timer = setTimeout(function() { sock.setup(count+1); },25);
			return;
		} else {
			this.decaf.error('Unable to load SWFObject. Please download it from {0}.'.tr(this.decaf,'<a href="http://code.google.com/p/swfobject/">http://code.google.com/p/swfobject/</a>'));
		}
	}
	
	// Get the target
	var swflocation = this.decaf.options.set_socket.swf;
	
	// Set a timer to display an error if we fail creating the socket.
	this.decaf.timer = setTimeout(function() { sock.noSocket(); }, 2500);
	
	// Be sure our ID is unique.
	while ( document.getElementById(this.id) !== null ) {
		this.id += '_'; }
	
	// Create a div to host the socket.
	var div = document.createElement('div');
	div.style.cssText = 'display:none;position:absolute;width:0;height:0;left:-9000px;overflow:hidden!important;margin:0!important;padding:0!important;';
	div.id = this.id;
	document.body.insertBefore(div,document.body.firstChild); //appendChild(div);
	
	// Finally, attempt socket creation.
	swfobject.embedSWF(
		swflocation + '?' + this.id,		// Source File
		this.id,							// ID
		'0', '0',							// Width x Height
		'9.0.0',							// Min. Version
		false,								// Express Install URL
		{},									// Flash Variables
		{'menu' : 'false' },				// Parameters
		{},									// Attributes
		function(e) { sock.onSocket(e) }	// Callback Function
	);
}

// Error if there is no socket.
FlashSocket.prototype.noSocket = function() {
	clearTimeout(this.decaf.timer);
	this.decaf.error('Unable to create a Flash socket. Please ensure that you have the Adobe Flash plugin installed and that it\'s currently up to date.'.tr(this.decaf));
}

// Callback for SWFObject
FlashSocket.prototype.onSocket = function(e) {
	// Clear the timer.
	clearTimeout(this.decaf.timer);
	
	if ( e.success ) {
		// Successful! Store a reference to this Flash socket. We have to wait
		// for Flash to start communicating now though.
		FlashSocket.sockets[e.id] = this;
		this.socket = e.ref;
		//this.decaf.socketReady();
		
	} else {
		// Not successful. Check Flash player version.
		if ( ! swfobject.hasFlashPlayerVersion('9.0.0') ) {
			var ver = swfobject.getFlashPlayerVersion();
			if ( ver.major === 0 ) {
				this.decaf.error('DecafMUD\'s Flash connectivity requires Adobe Flash 9 or later. Please <a href="http://get.adobe.com/flashplayer/">install</a> Flash.'.tr(this.decaf));
			} else {
				this.decaf.error("DecafMUD's Flash connectivity requires at least Adobe Flash version 9.0. You have version {0}.{1}.{2}. Please <a href=\"http://get.adobe.com/flashplayer/\">upgrade</a> your Flash plugin.".tr(this.decaf,ver.major,ver.minor,ver.release));
			}
		} else {
			this.decaf.error("There was an unknown error (though most likely a 404) loading the Flash socket file.".tr(this.decaf));
		}
	}
}

// Connect to the remote server.
FlashSocket.prototype.connect = function() {
	// If we're connected, disconnect.
	if ( this.connected && this.socket ) {
		this.socket.close(); }
	
	// If policy port isn't 843, set it.
	if ( this.decaf.options.set_socket.policyport !== 843 && this.decaf.options.set_socket.policyport !== undefined ) {
		this.socket.setPolicyPort(this.decaf.options.set_socket.policyport); }
	
	// Get the hostname and port
	var host = this.host, port = this.port;
	if ( host === undefined ) {
		host = this.decaf.options.host;
		if ( ! host ) { host = document.location.host; }
		this.host = host;
	}
	if ( port === undefined ) {
		port = this.decaf.options.port;
		this.port = port; }
	
	// Attempt to connect.
	this.socket.connect(host, port);
}

// Close the current connection.
FlashSocket.prototype.close = function() {
	this.connected = false;
	if ( this.socket ) {
		this.socket.close(); }
}

// Ensure we're connected.
FlashSocket.prototype.assertConnected = function() {
	if ( ! this.connected || ! this.socket ) {
		throw "DecafMUD is not currently connected."; }
}

// Send data to the server.
FlashSocket.prototype.write = function(data) {
	this.assertConnected();
	this.socket.write(encodeFS(data));
}

// The Flash Callback
DecafMUD.flashCallback = function(id, type, data, data2) {
	setTimeout(function() {
		FlashSocket.executeCallback(id, type, data, data2);
	}, 0);
}

// 0 = INIT, 1 = CONNECT, 2 = CLOSE, 3 = ERROR, 4 = DATA
// Now, the actual callback
FlashSocket.executeCallback = function(id, type, data, data2) {
	var sock = FlashSocket.sockets[id];
	
	if ( type === 0 ) {
		// Socket Ready
		sock.ready = true;
		sock.decaf.socketReady(sock); }
	
	else if ( type === 1 ) {
		// Connected
		sock.connected = true;
		sock.decaf.socketConnected(sock); }
	
	else if ( type === 2 ) {
		// Closed
		sock.connected = false;
		sock.decaf.socketClosed(sock); }
	
	else if ( type === 3 ) {
		// Error
		sock.decaf.socketError(data, data2); }
	
	else if ( type === 4 ) {
		// Data Received
		if ( data.length > 0 ) {
		sock.decaf.socketData(decodeFS(data)); } }
	
	else if ( type === 5 ) {
		// Socket Debug
		if ( data == 'mccp' ) {
			sock.decaf.debugString('RCVD ' + DecafMUD.debugIAC(data2));
		} else if ( data === 'mccp-out' ) {
			sock.decaf.debugString('SENT ' + DecafMUD.debugIAC(data2));
		} else {
			if ( data2 !== undefined ) { data2 = '  data2="'+data2+'"'; }
			else { data2 = ''; }
			sock.decaf.debugString('Flash Debug: ' + data + data2);
		}
	}
	
	else {
		sock.decaf.debugString('Unknown Flash Callback: type={0} data="{1} data2="{2}"'.tr(sock.decaf, type, data, data2));
	}
}

// Expose to DecafMUD
DecafMUD.plugins.Socket.flash = FlashSocket;

// Expose the callback so Flash can use it.
DecafMUDFlashSocket = {};
DecafMUDFlashSocket.flashCallback = DecafMUD.flashCallback;

})(DecafMUD);