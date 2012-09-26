/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD TELOPT Handler: ZMP
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

(function(DecafMUD) {

// Shortcut the TELNET constants for ease of use.
var t = DecafMUD.TN;

/** Handles the TELNET option ZMP.
 * @name ZMP
 * @class DecafMUD TELOPT Handler: ZMP
 * @exports ZMP as DecafMUD.plugins.Telopt.]
 * @param {DecafMUD} decaf The instance of DecafMUD using this plugin. */
var ZMP = function(decaf) { this.decaf = decaf; this.decaf.zmp = this; }

/** Helper for sending ZMP messages. */
ZMP.prototype.sendZMP = function(cmd, data) {
	var out = '';
	if ( data !== undefined ) {
		out = '\x00' + data.join('\x00');
	}
	
	this.decaf.sendIAC(t.IAC + t.SB + t.ZMP + cmd + out + '\x00' + t.IAC + t.SE);
}

/** Send the zmp.ident message upon connecting. */
ZMP.prototype._will = function() {
	var z = this;
	setTimeout(function(){
		z.sendZMP('zmp.ident', [
			"DecafMUD",
			DecafMUD.version.toString(),
			"HTML5 MUD Client - keep Java out of your browser"]);
	},0);
}

/** Handle an incoming ZMP command. */
ZMP.prototype._sb = function(data) {
	// If there's no NUL byte, or the first byte is NUL, return.
	if ( data.indexOf('\x00') < 1 ) { return; }
	var dat = data.split('\x00');
	var cmd = dat.shift();
	
	// Debug it.
	this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.ZMP + data + t.IAC + t.SE ));
	
	// Get the function.
	var func = this.getFunction(cmd);
	if ( func ) { func.call(this, cmd, dat); }
	
	// We debugged ourself.
	return false;
}

/** Find a given command. */
ZMP.prototype.getFunction = function(cmd, package_ok) {
	var parts = cmd.split('.'), top = ZMP.commands;
	while(parts.length > 0) {
		var part = parts.shift();
		if ( top[part] === undefined ) { return undefined; }
		top = top[part];
	}
	
	if (typeof top === 'function') { return top; }
	if (package_ok === true ) { return top; }
	return undefined;
}

/** Add a new command. */
ZMP.prototype.addFunction = function(cmd, func) {
	var parts = cmd.split('.');
	cmd = parts.pop();
	
	// Go through the path, adding arrays as necessary.
	var top = ZMP.commands;
	while(parts.length > 0) {
		var part = parts.shift();
		if ( top[part] === undefined ) {
			top[part] = {};
		}
		top = top[part];
	}
	
	// Add our command.
	top[cmd] = func;
}

/** The command structure. */
ZMP.commands = {};

/** The zmp.check Command */
ZMP.commands.zmp = {
	'check' : function(cmd, data) {
		for(var i=0,l=data.length;i<l;i++) {
			var c = data[i];
			if ( c.length > 0 ) {
				func = this.getFunction((c.substr(-1) == '.' ? c.substr(0,c.length-1) : c), true);
				if ( func === undefined ) {
					this.sendZMP("zmp.no-support", [c]);
				} else {
					this.sendZMP("zmp.support", [c]);
				}
			}
		}
	},
	
	'ping' : function(cmd, data) {
		var c = new Date();
		var yr = c.getUTCFullYear().toString(),
			mn = (c.getUTCMonth()+1).toString(),
			dy = c.getUTCDate().toString(),
			hr = c.getUTCHours().toString(),
			mi = c.getUTCMinutes().toString(),
			sc = c.getUTCSeconds().toString();
		if (mn.length < 2 ) { mn = '0' + mn; }
		if (dy.length < 2 ) { dy = '0' + dy; }
		if (hr.length < 2 ) { hr = '0' + hr; }
		if (mi.length < 2 ) { mi = '0' + mi; }
		if (sc.length < 2 ) { sc = '0' + sc; }
		this.sendZMP("zmp.time",[yr+'-'+mn+'-'+dy+' '+hr+':'+mi+':'+sc])
	}
}

// Expose it to DecafMUD
DecafMUD.plugins.Telopt[t.ZMP] = ZMP;
})(DecafMUD);