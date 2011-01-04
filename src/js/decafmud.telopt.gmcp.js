/*!
 * DecafMUD v0.9.0
 * http://decafmud.kicks-ass.net
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD TELOPT Handler: GMCP
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

(function(DecafMUD) {

// Shortcut the TELNET constants for ease of use.
var t = DecafMUD.TN;

/** Handles the TELNET option GMCP.
 * @name GMCP
 * @class DecafMUD TELOPT Handler: GMCP
 * @exports GMCP as DecafMUD.plugins.Telopt.É
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
var GMCP = function(decaf) { this.decaf = decaf; this.decaf.gmcp = this; }
GMCP.prototype.pingDelay = 60;
GMCP.prototype.pingAverage = 0;
GMCP.prototype.pingCount = 0;
GMCP.prototype.pingWhen = undefined;
GMCP.prototype.pingTimer = undefined;

/** Helper for sending GMCP messages. */
GMCP.prototype.sendGMCP = function(pckg, data) {
	var out = '';
	if ( data !== undefined ) { 
		out = JSON.stringify([data]);
		out = ' ' + out.substr(1, out.length-2); }

	this.decaf.sendIAC(t.IAC + t.SB + t.GMCP + pckg + out + t.IAC + t.SE);
}

/** Abort the ping information on disconnect. */
GMCP.prototype._wont = GMCP.prototype.disconnect = function() {
	clearTimeout(this.pingTimer);
	this.pingAverage = 0;
	this.pingCount = 0; }

/** Send the Core.Hello message upon connecting. */
GMCP.prototype._will = function() {
	var g = this; setTimeout(function(){
		g.sendGMCP("Core.Hello", {
			"client"	: "DecafMUD",
			"version"	: DecafMUD.version.toString()
		});
	}, 0);
	
	// Also, start the ping loop.
	this.pingTimer = setTimeout(function(){g.ping();}, this.pingDelay*1000);
}

/** Send a ping. */
GMCP.prototype.ping = function() {
	var avg = undefined;
	if ( this.pingCount > 0 ) { avg = this.pingAverage; }
	this.sendGMCP("Core.Ping", avg);
	this.pingWhen = new Date();
	
	// Schedule a new ping.
	var g = this;
	this.pingTimer = setTimeout(function(){g.ping();}, this.pingDelay*1000);
}

/** Handle an incoming GMCP message. */
GMCP.prototype._sb = function(data) {
	// Find the end of the package.
	var ind = data.search(/[^A-Za-z0-9._]/), ret = false, pckg, out;
	if ( ind !== -1 ) {
		pckg = data.substr(0, ind);
		if ( ind + 1 !== data.length ) {
			out = JSON.parse('['+data.substr(ind+1)+']')[0]; }
	} else { pckg = data; }
	
	// If there's no package, return.
	if ( pckg.length === 0 ) { return; }
	
	// Debug it.
	if ( out !== undefined && 'console' in window && console.groupCollapsed ) {
		console.groupCollapsed('DecafMUD['+this.decaf.id+'] RCVD IAC SB GMCP "'+pckg+'" ... IAC SE');
		console.dir(out);
		console.groupEnd('DecafMUD['+this.decaf.id+'] RCVD IAC SB GMCP "'+pckg+'" ... IAC SE');
	} else { ret = true; }
	
	// Get the function
	var func = this.getFunction(pckg);
	
	// Call it.
	if ( func ) { func.call(this, out); }
	
	return ret; // We print our own debug info.
}

/** Command to find a given function. */
GMCP.prototype.getFunction = function(pckg) {
	var parts = pckg.split('.'), top = this.packages;
	while(parts.length > 0) {
		var part = parts.shift();
		if ( top[part] === undefined ) { return undefined; }
		top = top[part];
	}
	
	if (typeof top === 'function') { return top; }
	return undefined;
}

/** Helper to add 

/** The package structure. */
GMCP.prototype.packages = {};

/** PACKAGE: Core */
GMCP.prototype.packages.Core = {
	' version' : 1,
	
	'Ping' : function(data) {
		var n = new Date() - this.pingWhen;
		this.pingCount++;
		this.pingAverage = Math.ceil((n + (this.pingAverage * (this.pingCount-1))) / this.pingCount);
		console.debug('PING: {0}ms over {1} pings'.tr(this.decaf,this.pingAverage,this.pingCount));
	},

	'Goodbye' : function(data) {
		this.decaf.debugString('Reason for disconnect: {0}'.tr(this.decaf,data));
	}
};

// Expose it to DecafMUD
DecafMUD.plugins.Telopt[t.GMCP] = GMCP;
//DecafMUD.plugins.Telopt.gmcp = true;
})(DecafMUD);