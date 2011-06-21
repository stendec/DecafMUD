/*!
 * DecafMUD v0.9.0
 * http://decafmud.kicks-ass.net
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

/**
 * @fileOverview DecafMUD's Core
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

// Extend the String prototype with endsWith and substr_count.
if ( String.prototype.endsWith === undefined ) {
	/** Determine if a string ends with the given suffix.
	 * @example
	 * if ( "some string".endsWith("ing") ) {
	 *   // Something Here!
	 * }
	 * @param {String} suffix The suffix to test.
	 * @returns {boolean} true if the string ends with the given suffix */
	String.prototype.endsWith = function(suffix) {
		var startPos = this.length - suffix.length;
		return startPos < 0 ? false : this.lastIndexOf(suffix, startPos) === startPos;
	}
}

if ( String.prototype.substr_count === undefined ) {
	/** Count the number of times a specific string occures within a larger
	 *  string.
	 * @example
	 * "This is a test of a fishy function for string counting.".substr_count("i");
	 * // Returns: 6
	 * @param {String} needle The text to search for.
	 * @returns {Number} The number of matches found. */
	String.prototype.substr_count = function(needle) {
		var count = 0,
			i = this.indexOf(needle);
		while ( i !== -1 ) {
			count++;
			i = this.indexOf(needle, i+1);
		}
		return count;
	}
}

// Extend Array with indexOf if it doesn't exist, for IE8
if ( Array.prototype.indexOf === undefined ) {
	Array.prototype.indexOf = function(text,i) {
		if ( i === undefined ) { i = 0; }
		for(;i<this.length;i++){if(this[i]===text){return i;}}
		return -1;
	}
}

// The obligatory, oh-so-popular wrapper function
(function(window) {

// Create a function for extending Objects
var extend_obj = function(base, obj) {
	for ( var key in obj ) {
		var o = obj[key];
		if ( typeof o === 'object' && !('nodeType' in o) ) {
			if ( o.push !== undefined ) {
				if ( base[key] === undefined ) { base[key] = []; }
				for(var i=0; i<o.length; i++) {
					base[key].push(o[i]);
				}
			} else {
				if ( base[key] === undefined ) { base[key] = {}; }
				if ( typeof base[key] === 'object' ) {
					extend_obj(base[key], o);
				}
			}
		} else {
			base[key] = o;
		}
	}
	return base;
}

/**
 * Create a new instance of the DecafMUD client.
 * @name DecafMUD
 * @class The DecafMUD Core
 * @property {boolean} loaded This is true if DecafMUD has finished loading all
 *     the external files it requires. We won't start executing anything until
 *     this is true.
 * @property {boolean} connecting This is true while DecafMUD is trying to
 *     connect to a server and is still waiting for the socket to respond.
 * @property {boolean} connected This is true if DecafMUD is connected to a
 *     server. For internal use.
 * @property {number} id The id of the DecafMUD instance.
 * @param {Object} options Configuration settings for setting up DecafMUD.
 */
var DecafMUD = function DecafMUD(options) {
	// Store the options for later.
	this.options = {};
	extend_obj(this.options, DecafMUD.options);
	
	if ( options !== undefined ) {
		if ( typeof options !== 'object' ) { throw "The DecafMUD options argument must be an object!"; }
		extend_obj(this.options, options);
	}
	
	// Store the settings for later.
	this.settings = {};
	extend_obj(this.settings, DecafMUD.settings);
	
	// Set up the objects that'd be shared.
	this.need = [];
	this.inbuf = [];
	this.telopt = {};
	
	// If language is set to autodetect, then detect it.
	if ( this.options.language === 'autodetect' ) {
		var lang = navigator.language ? navigator.language : navigator.userLanguage;
		this.options.language =lang.split('-',1)[0];
	}
	
	// Increment DecafMUD.last_id and use that as this instance's ID.
	this.id = ( ++DecafMUD.last_id );
	
	// Store this instance for easy retrieval.
	DecafMUD.instances.push(this);
	
	// Start doing debug stuff.
	this.debugString('Created new instance.', 'info');
	
	// If we have console grouping, log the options.
	if ( 'console' in window && console.groupCollapsed ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Provided Options');
		console.dir(this.options);
		console.groupEnd();
	}
	
	// Require the language first, then the UI.
	if ( this.options.language !== 'en' && this.options.load_language  ) {
		this.require('decafmud.language.'+this.options.language); }
	this.require('decafmud.interface.'+this.options.interface);
	
	// Load those. After that, chain to the initSplash function.
	this.waitLoad(this.initSplash);
	
	return this;
};

// Instance Information
/** <p>An array with references to all the created instances of DecafMUD.</p>
 *  <p>Generally, each DecafMUD's id is the instance's index in
 *  this array.</p>
 * @type DecafMUD[] */
DecafMUD.instances	= [];

/** The ID of the latest instance of DecafMUD.
 * @type number */
DecafMUD.last_id	= -1;

/** DecafMUD's version. This can be used to check plugin compatability.
 * @example
 * if ( DecafMUD.version.major >= 1 ) {
 *   // Some Code Here
 * }
 * @example
 * alert("You're using DecafMUD v" + DecafMUD.version.toString() + "!");
 * // You're using DecafMUD v0.9.0alpha!
 * @type Object */
DecafMUD.version = {major: 0, minor: 9, micro: 0, flag: 'alpha',
	toString: function(){ return this.major+'.'+this.minor+'.'+this.micro+( this.flag ? '-' + this.flag : ''); } };

// Default Values
DecafMUD.prototype.loaded		= false;
DecafMUD.prototype.connecting	= false;
DecafMUD.prototype.connected	= false;

DecafMUD.prototype.loadTimer	= null;
DecafMUD.prototype.timer		= null;
DecafMUD.prototype.connect_try	= 0;
DecafMUD.prototype.required		= 0;

///////////////////////////////////////////////////////////////////////////////
// Plugins System
///////////////////////////////////////////////////////////////////////////////
/** This object stores all the available plugins for DecafMUD using a simple
 *  hierarchy. Every plugin should register itself in this tree once it's done
 *  loading.
 * @example
 * // Add the plugin MyPluginClass to DecafMUD as my_plugin.
 * DecafMUD.plugins.Extra.my_plugin = MyPluginClass;
 * @namespace All the available plugins for {@link DecafMUD}, in one easy-to-access
              tree. */
DecafMUD.plugins = {
	/** These plugins provide support for MUD output.
	 * @type Object */
	Display		: {},
	
	/** These plugins provide support for different text encodings.
	 * @type Object */
	Encoding	: {},
	
	/** These plugins don't fit into any other categories.
	 * @type Object */
	Extra		: {},
	
	/** These plugins provide user interfaces for the client.
	 * @type Object */
	Interface	: {},
	
	/** These plugins provide translations to other languages.
	 * @type Object */
	Language	: {},
	
	/** These plugins provide sockets for network connectivity, a must for a
	 *  mud client.
	 * @type Object */
	Socket		: {},
	
	/** These plugins provide persistent storage for the client, letting the
	 *  client remember user settings across browser sessions.
	 * @type Object */
	Storage		: {},
	
	/** These plugins provide extra telnet options for adding more sophisticated
	 *  client/server interaction to DecafMUD.
	 * @type Object */
	Telopt		: {}
};

/** This plugin handles conversion between raw data and iso-8859-1 encoded
 *  text, somewhat unimpressively as they're effectively the same thing.
 * @type Object */
/** This provides support for iso-8859-1 encoded data to DecafMUD, which isn't
 *  saying much as you realize that iso-8859-1 is simple, unencoded binary
 *  strings. We just have this so that the encoding system can work with a
 *  default encoder.
 * @example
 * alert(DecafMUD.plugins.Encoding.iso88591.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: iso-8859-1 */
DecafMUD.plugins.Encoding.iso88591 = {
	proper : 'ISO-8859-1',
	
	/** Convert iso-8859-1 encoded text to unicode, by doing nothing.
     * @example
     * DecafMUD.plugins.Encoding.iso88591.decode("\xE2\x96\x93");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to decode. */
	decode : function(data) { return [data,'']; },
	/** Convert unicode characters to iso-8859-1 encoded text, by doing
	 *  nothing. Should probably add some sanity checks in later, but I
	 *  don't really care for now.
     * @example
     * DecafMUD.plugins.Encoding.iso88591.encode("\xE2\x96\x93");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to encode. */
	encode : function(data) { return data; }
};

/** This provides support for UTF-8 encoded data to DecafMUD, using built-in
 *  functions in a slightly hack-ish way to convert between UTF-8 and unicode.
 * @example
 * alert(DecafMUD.plugins.Encoding.utf8.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: UTF-8 */
DecafMUD.plugins.Encoding.utf8 = {
	proper : 'UTF-8',
	
	/** Convert UTF-8 sequences to unicode characters.
     * @example
     * DecafMUD.plugins.Encoding.utf8.decode("\xE2\x96\x93");
     * // Becomes: "\u2593"
     * @param {String} data The text to decode. */
	decode : function(data) {
		try { return [decodeURIComponent( escape( data ) ), '']; }
		catch(err) {
			// Decode manually so we can catch what's left.
			var out = '', i=0, l=data.length,
				c = c2 = c3 = c4 = 0;
			while ( i < l ) {
				c = data.charCodeAt(i++);
				if ( c < 0x80) {
					// Normal Character
					out += String.fromCharCode(c); }
				
				else if ( (c > 0xBF) && (c < 0xE0) ) {
					// Two-Byte Sequence
					if ( i+1 >= l ) { break; }
					out += String.fromCharCode(((c & 31) << 6) | (data.charCodeAt(i++) & 63)); }
				
				else if ( (c > 0xDF) && (c < 0xF0) ) {
					// Three-Byte Sequence
					if ( i+2 >= l ) { break; }
					out += String.fromCharCode(((c & 15) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				
				else if ( (c > 0xEF) && (c < 0xF5) ) {
					// Four-Byte Sequence
					if ( i+3 >= l ) { break; }
					out += String.fromCharCode(((c & 10) << 18) | ((data.charCodeAt(i++) & 63) << 12) | ((data.charCodeAt(i++) & 63) << 6) | (data.charCodeAt(i++) & 63)); }
				
				else {
					// Bad Character.
					out += String.fromCharCode(c); }
			}
			return [out, data.substr(i)];
		} },
	
	/** Encode unicode characters into UTF-8 sequences.
     * @example
     * DecafMUD.plugins.Encoding.utf8.encode("\u2593");
     * // Becomes: "\xE2\x96\x93"
     * @param {String} data The text to encode. */
	encode : function(data) {
		try { return unescape( encodeURIComponent( data ) ); }
		catch(err) {
			console.dir(err); return data; } }
};

/** The variable storing instances of plugins is called loaded_plugs to avoid
 *  any unnecessary confusion created by {@link DecafMUD.plugins}.
 * @type Object */
DecafMUD.prototype.loaded_plugs = {};

// Create a function for class inheritence
var inherit = function(subclass, superclass) {
	var f = function() {};
	f.prototype = superclass.prototype;
	subclass.prototype = new f();
	subclass.superclass = superclass.prototype;
	if ( superclass.prototype.constructor == Object.prototype.constructor ) {
		superclass.prototype.constructor = superclass; }
};

///////////////////////////////////////////////////////////////////////////////
// TELNET Internals
///////////////////////////////////////////////////////////////////////////////
// Extra Constants
DecafMUD.ESC = "\x1B";
DecafMUD.BEL = "\x07";

// TELNET Constants
DecafMUD.TN = {
	// Negotiation Bytes
	IAC			: "\xFF", // 255
	DONT		: "\xFE", // 254
	DO			: "\xFD", // 253
	WONT		: "\xFC", // 252
	WILL		: "\xFB", // 251
	SB			: "\xFA", // 250
	SE			: "\xF0", // 240
	
	IS			: "\x00", // 0
	
	// END-OF-RECORD Marker / GO-AHEAD
	EORc		: "\xEF", // 239
	GA			: "\xF9", // 249
	
	// TELNET Options
	BINARY		: "\x00", // 0
	ECHO		: "\x01", // 1
	SUPGA		: "\x03", // 3
	STATUS		: "\x05", // 5
	SENDLOC		: "\x17", // 23
	TTYPE		: "\x18", // 24
	EOR			: "\x19", // 25
	NAWS		: "\x1F", // 31
	TSPEED		: "\x20", // 32
	RFLOW		: "\x21", // 33
	LINEMODE	: "\x22", // 34
	AUTH		: "\x23", // 35
	NEWENV		: "\x27", // 39
	CHARSET		: "\x2A", // 42
	
	MSDP		: "E", // 69
	MSSP		: "F", // 70
	COMPRESS	: "U", // 85
	COMPRESSv2	: "V", // 86
	MSP			: "Z", // 90
	MXP			: "[", // 91
	ZMP			: "]", // 93
	CONQUEST	: "^", // 94
	ATCP		: "\xC8", // 200
	GMCP		: "\xC9", // 201
}
var t = DecafMUD.TN;

var iacToWord = function(c) {
	var t = DecafMUD.TN;
	switch(c) {
		case t.IAC			: return 'IAC';
		case t.DONT			: return 'DONT';
		case t.DO			: return 'DO';
		case t.WONT			: return 'WONT';
		case t.WILL			: return 'WILL';
		case t.SB			: return 'SB';
		case t.SE			: return 'SE';
		
		case t.BINARY		: return 'TRANSMIT-BINARY';
		case t.ECHO			: return 'ECHO';
		case t.SUPGA		: return 'SUPPRESS-GO-AHEAD';
		case t.STATUS		: return 'STATUS';
		case t.SENDLOC		: return 'SEND-LOCATION';
		case t.TTYPE		: return 'TERMINAL-TYPE';
		case t.EOR			: return 'END-OF-RECORD';
		case t.NAWS			: return 'NEGOTIATE-ABOUT-WINDOW-SIZE';
		case t.TSPEED		: return 'TERMINAL-SPEED';
		case t.RFLOW		: return 'REMOTE-FLOW-CONTROL';
		case t.AUTH			: return 'AUTH';
		case t.LINEMODE		: return 'LINEMODE';
		case t.NEWENV		: return 'NEW-ENVIRON';
		case t.CHARSET		: return 'CHARSET';
		
		case t.MSDP			: return 'MSDP';
		case t.MSSP			: return 'MSSP';
		case t.COMPRESS		: return 'COMPRESS';
		case t.COMPRESSv2	: return 'COMPRESSv2';
		case t.MSP			: return 'MSP';
		case t.MXP			: return 'MXP';
		case t.ZMP			: return 'ZMP';
		case t.CONQUEST		: return 'CONQUEST-PROPRIETARY';
		case t.ATCP			: return 'ATCP';
		case t.GMCP			: return 'GMCP';
	}
	c = c.charCodeAt(0);
	if ( c > 15 ) { return c.toString(16); }
	else { return '0' + c.toString(16); }
}

/** Convert a telnet IAC sequence from raw bytes to a human readable format that
 *  can be output for debugging purposes.
 * @example
 * var IAC = "\xFF", DO = "\xFD", TTYPE = "\x18";
 * DecafMUD.debugIAC(IAC + DO + TTYPE);
 * // Returns: "IAC DO TERMINAL-TYPE"
 * @param {String} seq The sequence to convert.
 * @returns {String} The human readable description of the IAC sequence. */
DecafMUD.debugIAC = function(seq) {
	var out = '', t = DecafMUD.TN, state = 0, st = false, l = seq.length,
		i2w = iacToWord;
	
	for( var i = 0; i < l; i++ ) {
		var c = seq.charAt(i),
			cc = c.charCodeAt(0);
		
		// TTYPE Sequence
		if ( state === 2 ) {
			if ( c === t.ECHO ) { out += 'SEND '; }
			else if ( c === t.IS ) { out += 'IS '; }
			else if ( c === t.IAC ) {
				if ( st ) { st = false; out += '" IAC '; }
				else { out += 'IAC '; }
				state = 0;
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
			continue;
		}
		
		// MSSP / MSDP Sequence
		else if ( state === 3 || state === 4 ) {
			if ( c === t.IAC || (cc >= 1 && cc <= 4) ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 3 ) { out += 'MSDP_OPEN '; }
				else if ( cc === 4 ) { out += 'MSDP_CLOSE '; }
				else {
					if ( state === 3 ) { out += 'MSSP_'; }
					else { out += 'MSDP_'; }
					if ( cc === 1 ) { out += 'VAR '; }
					else { out += 'VAL '; }
				}
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
			continue;
		}
		
		// NAWS Sequence
		else if ( state === 5 ) {
			if ( c === t.IAC ) {
				st = false; out += 'IAC ';
				state = 0;
			} else {
				if ( st === false ) { st = cc * 255; }
				else {
					out += (cc + st).toString() + ' ';
					st = false;
				}
			}
			continue;
		}
		
		// CHARSET Sequence
		else if ( state === 6 ) {
			if ( c === t.IAC || (cc > 0 && cc < 8) ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 1 ) { out += 'REQUEST '; }
				else if ( cc === 2 ) { out += 'ACCEPTED '; }
				else if ( cc === 3 ) { out += 'REJECTED '; }
				else if ( cc === 4 ) { out += 'TTABLE-IS '; }
				else if ( cc === 5 ) { out += 'TTABLE-REJECTED '; }
				else if ( cc === 6 ) { out += 'TTABLE-ACK '; }
				else if ( cc === 7 ) { out += 'TTABLE-NAK '; }
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
		}
		
		// ZMP Sequence
		else if ( state === 7 ) {
			if ( c === t.IAC || cc === 0 ) {
				if ( st ) { st = false; out += '" '; }
				if ( c === t.IAC ) {
					out += 'IAC ';
					state = 0; }
				else if ( cc === 0 ) { out += 'NUL '; }
			} else {
				if ( !st ) { st = true; out += '"'; }
				out += c;
			}
		}
		
		// Normal Sequence
		else if ( state < 2 ) {
			out += i2w(c) + ' '; }
		
		if ( state === 0 ) {
			if ( c === t.SB ) { state = 1; }
		} else if ( state === 1 ) {
			if ( c === t.TTYPE || c === t.TSPEED ) { state = 2; }
			else if ( c === t.MSSP ) { state = 3; }
			else if ( c === t.MSDP ) { state = 4; }
			else if ( c === t.NAWS ) { state = 5; }
			else if ( c === t.CHARSET ) { state = 6; }
			else if ( c === t.SENDLOC ) { state = 6; }
			else if ( c === t.GMCP ) { state = 6; }
			else if ( c === t.ZMP ) { state = 7; }
			else { state = 0; }
		}
	}
	
	return out.substr(0, out.length-1);
}

///////////////////////////////////////////////////////////////////////////////
// TELOPTS
///////////////////////////////////////////////////////////////////////////////

/** Handles the telopt TTYPE. */
var tTTYPE = function(decaf) { this.decaf = decaf; }
tTTYPE.prototype.current = -1
tTTYPE.prototype._dont = tTTYPE.prototype.disconnect = function() { this.current = -1; }
tTTYPE.prototype._sb = function(data) {
	if ( data !== t.ECHO ) { return; }
	this.current = (this.current + 1) % this.decaf.options.ttypes.length;
	this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.TTYPE + t.ECHO + t.IAC + t.SE));
	this.decaf.sendIAC(t.IAC + t.SB + t.TTYPE + t.IS + this.decaf.options.ttypes[this.current] + t.IAC + t.SE);
	
	return false; // We print our own debug info.
}
DecafMUD.plugins.Telopt[t.TTYPE] = tTTYPE;

/** Handles the telopt ECHO. */
var tECHO = function(decaf) { this.decaf = decaf; }
tECHO.prototype._will = function() {
	if ( this.decaf.ui ) { this.decaf.ui.localEcho(false); } }
tECHO.prototype._wont = tECHO.prototype.disconnect = function() {
	if ( this.decaf.ui ) { this.decaf.ui.localEcho(true); } }
DecafMUD.plugins.Telopt[t.ECHO] = tECHO;


/** Handles the telopt NAWS. */
var tNAWS = function(decaf) { this.decaf = decaf; }
tNAWS.prototype.enabled = false;
tNAWS.prototype.last = undefined;
tNAWS.prototype._do = function() { this.last = undefined; this.enabled = true;
	var n=this; setTimeout(function(){n.send();},0); }
tNAWS.prototype._dont = tNAWS.prototype.disconnect = function() { this.enabled = false; }
tNAWS.prototype.send = function() {
	if ((!this.decaf.display) || (!this.enabled)) { return; }
	var sz = this.decaf.display.getSize();
	if ( this.last !== undefined && this.last[0] == sz[0] && this.last[1] == sz[1] ) { return; }
	this.last = sz;
	var data = String.fromCharCode(Math.floor(sz[0] / 255));
	data += String.fromCharCode(sz[0] % 255);
	data += String.fromCharCode(Math.floor(sz[1] / 255));
	data += String.fromCharCode(sz[1] % 255);
	data = t.IAC + t.SB + t.NAWS + data.replace(/\xFF/g,'\xFF\xFF') + t.IAC + t.SE;
	this.decaf.sendIAC(data);
}
DecafMUD.plugins.Telopt[t.NAWS] = tNAWS;


/** Handles the telopt CHARSET. */
var tCHARSET = function(decaf) { this.decaf = decaf; }
//tCHARSET.prototype.connect = function() { this.decaf.sendIAC(t.IAC + t.WILL + t.CHARSET); }
tCHARSET.prototype._dont = function() { return false; }
tCHARSET.prototype._will = function() { var c = this; setTimeout(function() {
	var cs = [], done = [];
	
	// Add the current encoding first if not ISO-8859-1
	var e = this.decaf.options.encoding;
	if ( e !== 'iso88591' && DecafMUD.plugins.Encoding[e] !== undefined && DecafMUD.plugins.Encoding[e].proper !== undefined ) {
		cs.push(DecafMUD.plugins.Encoding[e].proper);
		done.push(e);
	}
	
	// Add the encodings in the order we want.
	for(var i=0;i<this.decaf.options.encoding_order.length;i++) {
		var e = this.decaf.options.encoding_order[i];
		if ( DecafMUD.plugins.Encoding[e] === undefined || DecafMUD.plugins.Encoding[e].proper === undefined || done.indexOf(e) !== -1 ) { continue; }
		cs.push(DecafMUD.plugins.Encoding[e].proper);
		done.push(e);
	}
	
	// Add the rest now.
	for(var k in DecafMUD.plugins.Encoding) {
		if ( done.indexOf(k) !== -1 || DecafMUD.plugins.Encoding[k].proper === undefined ) { continue; }
		cs.push(DecafMUD.plugins.Encoding[k].proper);
	}
	
	c.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + t.ECHO + ' ' + cs.join(' ') + t.IAC + t.SE);
},0); }
tCHARSET.prototype._sb = function(data) {
	// Print debug.
	this.decaf.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + t.CHARSET + data + t.IAC + t.SE));
	
	// Is it REQUEST?
	if ( data.charCodeAt(0) === 1 ) {
		data = data.substr(1);
		
		// Is there a TTABLE? We don't support that, so ignore.
		if ( data.indexOf('TTABLE ') === 0 ) {
			data = data.substr(8); }
			
		// The first character is the separator.
		var sep = data.charAt(0);
		data = data.substr(1).split(sep);
		
		// Find the first one we accept.
		var e = undefined, o;
		for(var i=0;i < data.length; i++) {
			o = data[i];
			for(var k in DecafMUD.plugins.Encoding) {
				if ( o === k || o === DecafMUD.plugins.Encoding[k].proper ) {
					e = k;
					break; }
			}
			if ( e ) { break; }
		}
		
		if ( e !== undefined ) {
			this.decaf.setEncoding(e);
			this.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + '\x02' + o + t.IAC + t.SE);
		} else {
			// Reject it.
			this.decaf.debugString("No encoder for: " + data.join(sep));
			this.decaf.sendIAC(t.IAC + t.SB + t.CHARSET + '\x03' + t.IAC + t.SE);
		}
	}
	
	// Is it ACCEPTED?
	else if ( data.charCodeAt(0) === 2 ) {
		data = data.substr(1);
		
		// Get the character set.
		var e = undefined;
		for(var k in DecafMUD.plugins.Encoding) {
			if ( DecafMUD.plugins.Encoding[k].proper === data ) {
				e = k;
				break;
			}
		}
		
		// If we have e, use it.
		if ( e !== undefined ) { this.decaf.setEncoding(e); }
	}
	
	return false; // We print our own debug.
}
DecafMUD.plugins.Telopt[t.CHARSET] = tCHARSET;


/** Read a string of MSDP-formatted variables and return an object with those
 *  variables in an easy-to-use format. This calls itself recursively, and
 *  returns an array. The first item being the object, and the second being
 *  any left over string.
 * @param {String} data The MSDP-formatted data to read.
 * @returns {Array} */
var msdp = /[\x01\x02\x03\x04]/;
var readMSDP = function(data) {
	var out = {};
	var variable = undefined;
	
	// Loop through data
	while ( data.length > 0 ) {
		// Attempt to read a control character.
		var c = data.charCodeAt(0);
	
		if ( c === 1 ) {
			// MSDP_VAR. Read a variable name from data and reset the variable
			// in out.
			var ind = data.substr(1).search(msdp);
			if ( ind === -1 ) {
				variable = data.substr(1);
				data = '';
			} else {
				variable = data.substr(1, ind);
				data = data.substr(ind+1);
			}
			
			// Reset the variable, and continue.
			out[variable] = undefined;
			continue;
		}
		
		else if ( c === 4 ) {
			// MSDP_CLOSE. Return what we have.
			data = data.substr(1);
			break;
		}
		
		// Make sure we have a variable name. If not, quit.
		if ( variable === undefined ) {
			return [out, ''];
		}
		
		if ( c === 2 ) {
			// MSDP_VAL. Read a value. If variable isn't undefined, turn it into
			// an array if it isn't one.
			
			// Is this a MSDP_OPEN?
			if ( data.charCodeAt(1) === 3 ) {
				var o = readMSDP(data.substr(2));
				val = o[0];
				data = o[1];
			} else {
				var ind = data.substr(1).search(msdp), val = '';
				if ( ind === -1 ) {
					val = data.substr(1);
					data = '';
				} else {
					val = data.substr(1, ind);
					data = data.substr(ind+1);
				}
			}
			
			// Check the existing variable.
			if ( out[variable] === undefined ) {
				out[variable] = val;
			} else if ( typeof out[variable] === 'object' && out[variable].push !== undefined ) {
				out[variable].push(val);
			} else {
				out[variable] = [out[variable], val];
			}
			
			continue;
		}
		
		// Still here? No command. Break then.
		break;
	}
	
	return [out, data];
};

/** Convert a variable to a string of valid MSDP-formatted data.
 * @param {any} obj The variable to convert. */
var writeMSDP = function(obj) {
	var t = typeof obj;
	if ( t === 'string' || t === 'number' ) { return obj.toString(); }
	else if ( t === 'boolean' ) { return obj ? '1' : '0'; }
	else if ( t === 'undefined' ) { return ''; }
	
	// Must be an object.
	else if ( t === 'object' ) {
		var out = '';
		for(var k in obj) {
			// Don't write out undefineds and nulls.
			if ( obj[k] === undefined || obj[k] === null || typeof obj[k] === 'function' ) { continue; }
			
			out += '\x01' + k;
			if ( typeof obj[k] === 'object' ) {
				if ( obj[k].push !== undefined ) {
					// Handle arrays differently than normal objects.
					var v = obj[k], l = obj[k].length;
					for(var i=0;i<l;i++) {
						out += '\x02' + writeMSDP(v[i]); }
				} else if ( obj[k].nodeType === undefined ) {
					// Make sure we don't get caught up in the DOM.
					out += '\x02\x03' + writeMSDP(obj[k]) + '\x04';
				}
			} else {
				out += '\x02' + writeMSDP(obj[k]);
			}
		}
		
		return out;
	}
	
	// Last ditch effort. toString it.
	return obj.toString();
};

/** Handles the telopt MSDP. */
var tMSDP = function(decaf) { this.decaf = decaf; }
tMSDP.prototype.connect = function() {
	this.commands = ['LIST'];
	this.variables = [];
	this.reportable = [];
}

tMSDP.config_vars = {
	'CLIENT_NAME'		: 'decafmud',
	'CLIENT_VERSION'	: DecafMUD.version.toString(),
	'PLUGIN_ID'			: '0',
	'ANSI_COLORS'		: '1',
	'UTF_8'				: '1',
	'XTERM_256_COLORS'	: '1'
}

/** Request a lot of different information from the server. */
tMSDP.prototype._will = function() { var m = this; setTimeout(function() {
	m.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02COMMANDS' + t.IAC + t.SE);
	m.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02VARIABLES' + t.IAC + t.SE);
	m.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02CONFIGURABLE_VARIABLES' + t.IAC + t.SE);
	m.decaf.sendIAC(t.IAC + t.SB + t.MSDP + '\x01LIST\x02REPORTABLE_VARIABLES' + t.IAC + t.SE);
},0); }

tMSDP.prototype._sb = function(data) {
	var out = readMSDP(data)[0], ret = false; // We don't care about the left over string.
	
	// Debug it before we do anything potentially destructive.
	if ( 'console' in window && console.groupCollapsed ) {
		console.groupCollapsed('DecafMUD['+this.decaf.id+']: RCVD IAC SB MSDP ... IAC SE');
		console.dir(out);
		console.groupEnd('DecafMUD['+this.decaf.id+']: RCVD IAC SB MSDP ... IAC SE');
	} else { ret = true; }
	
	// Check out for things we care about.
	if ( out['COMMANDS'] !== undefined ) {
		for(var i=0; i<out['COMMANDS'].length;i++) {
			this.commands.push(out['COMMANDS'][i]); }
	}
	
	if ( out['VARIABLES'] !== undefined ) {
		for(var i=0; i<out['VARIABLES'].length;i++) {
			this.variables.push(out['VARIABLES'][i]); }
	}
	
	if ( out['CONFIGURABLE_VARIABLES'] !== undefined ) {
		var o = out['CONFIGURABLE_VARIABLES'];
		var ot = {};
		// Built an array of stuff to send.
		for(var i=0;i<o.length;i++) {
			if ( tMSDP.config_vars[o[i]] !== undefined ) {
				ot[o[i]] = tMSDP.config_vars[o[i]]; }
		}
		// Send it.
		this.decaf.sendIAC(t.IAC + t.SB + t.MSDP + writeMSDP(ot) + t.IAC + t.SE);
	}
	
	return ret; // We handled our own debug output.
}
DecafMUD.plugins.Telopt[t.MSDP] = tMSDP;

/** We always transmit binary. What else would we transmit? */
DecafMUD.plugins.Telopt[t.BINARY] = true;

/** Only use MSSP for debugging purposes. */
DecafMUD.plugins.Telopt[t.MSSP] = 'console' in window;

///////////////////////////////////////////////////////////////////////////////
// Localization
///////////////////////////////////////////////////////////////////////////////
// Extend the string prototype with a new function for easy localization of
// our strings. Usage: alert( "This is an example.".tr(decaf_instance) );
if ( String.prototype.tr === undefined ) {
	// Set this to true if you want to write to the debugging log every time
	// we try translating a string with no available translation.
	/** If this is true, debugging messages will be written to the console
	 *  every time .tr() is called on a string with no available translation
	 *  in the target language.
	 * @default "false"
	 * @constant */
	String.logNonTranslated = true && 'console' in window;
	/** Translate a string from English to a different language, optionally
	 *  replacing special character sequences with the provided variables.
	 *
	 * @example
	 * alert( "This is a {0}.".tr(decaf, "test") );
	 *
	 * @param {DecafMUD} [decaf] Use the language set in this instance of
	 *    DecafMUD if set. If not set, use the language of the most recently
	 *    created DecafMUD instance.
	 * @param {Object} [obj] If an object is provided, variables will be
	 *    replaced in the string based upon the object's keys.
	 * @example
	 * // Example variable replacement using obj.
	 * "{name} broke his {bone}!".tr({name: "Fred", bone: "tibia"});
	 * // Becomes: "Fred broke his tibia!"
	 *
	 * @param {String|Number} [*args] If an object isn't provided, but additonal
	 *    arguments are present, variables will be replaced in the string
	 *    based upon the argument's index. Note that if the first argument
	 *    is an Object, index-based replacements won't be made.
	 * @example
	 * // Example variable replacement using multiple arguments.
	 * "{0} broke his {1}!".tr("Fred", "tibia");
	 * // Becomes: "Fred broke his tibia!"
	 * @returns {String} The translated text.
	 */
	String.prototype.tr = function() {
		var decaf, off, s, lang;
		if ( arguments.length > 0 && arguments[0] instanceof DecafMUD ) {
			decaf = arguments[0];
			off = 1;
		} else {
			// Since an instance wasn't specified, assume the latest instance.
			decaf = DecafMUD.instances[DecafMUD.instances.length - 1];
			off = 0;
		}
		
		// Get the language from our DecafMUD instance, then try getting the
		// translated string.
		lang = decaf.options.language;
		if ( lang === 'en' ) { s = this; }
		else {
			if (!( DecafMUD.plugins.Language[lang] && (s = DecafMUD.plugins.Language[lang][this]) )) {
				if ( String.logNonTranslated ) {
					var l = DecafMUD.plugins.Language[lang] && DecafMUD.plugins.Language[lang]['English'] !== undefined ?
						DecafMUD.plugins.Language[lang]['English'] : '"' + lang + '"';
					console.warn('DecafMUD[' + decaf.id + '] i18n: No ' + l + ' translation for: ' +
						this.replace(/\n/g,'\\n'));
				}
				s = this;
			}
		}
		
		// Do replacements to make this even more useful.
		if ( arguments.length - off === 1 && typeof arguments[off] === 'object' ) {
			var obj = arguments[off];
			for ( var i in obj ) {
				s = s.replace('{'+i+'}', obj[i]);
			}
		} else {
			var obj = arguments;
			s = s.replace(/{(\d+)}/g, function(m) {
				var p = parseInt(m[1]) + off;
				return p < obj.length ? obj[p] : '';
			});
		}
		
		// Return the fancy, translated, replaced string.
		return s;
	}
}

/** Display a dialog with About information for DecafMUD. */
DecafMUD.prototype.about = function() {
	var abt = ["DecafMUD v{0} \u00A9 2010 Stendec"];
	abt.push("http://decafmud.kicks-ass.net/\n");
	
	abt.push("DecafMUD is a web-based MUD client written in JavaScript, rather" +
		" than a plugin like Flash or Java, making it load faster and react as" +
		" you'd expect a website to.\n");
	
	abt.push("It's easy to customize as well, using simple CSS and JavaScript," +
		" and free to use and modify, so long as your MU* is free to play!");
	
	// Show the about dialog with a simple alert.
	alert(abt.join('\n').tr(this, DecafMUD.version.toString()));
}

///////////////////////////////////////////////////////////////////////////////
// Debugging
///////////////////////////////////////////////////////////////////////////////

/** Write a string to the debug console. The type can be one of: debug, info,
  * error, or warn, and defaults to debug. This does nothing if the console
  * doesn't exist.
  * @param {String} text The text to write to the debug console.
  * @param {String} [type="debug"] The type of message. One of: debug, info, error, warn
  * @param {Object} [obj]  An object with extra details for use in the provided text.
  * @example
  * var details = {name: "Fred", bone: "tibia"};
  * decaf.debugString("{name} broke their {bone}!", 'info', details);
  */
DecafMUD.prototype.debugString = function(text, type, obj) {
	// Return if we don't have the console or a debug pane.
	if (! 'console' in window ) { return; }
	
	// Set the type to debug by default
	if ( type === undefined ) { type = 'debug'; }
	
	// Prepare the string. It's almost certain it won't be translatable, but
	// the variable replacement is nice.
	if ( obj !== undefined ) { text = text.tr(this, obj); }
	
	// Firebug / Console Logging
	if (!( 'console' in window )) { return; }
	var st = 'DecafMUD[%d]: %s';
	switch(type) {
		case 'info':	console.info(st, this.id, text); return;
		case 'warn':	console.warn(st, this.id, text); return;
		case 'error':	console.error(st, this.id, text); return;
		default: 
			if ( 'debug' in console ) {
				console.debug(st, this.id, text);
				return;
			}
			console.log(st, this.id, text);
	}
}

/** Show an error to the user, either via the interface if it's loaded or,
 *  failing that, a call to alert().
 * @param {String} text The error message to display.
 * @example
 * decaf.error("My pants are on fire!");
 */
DecafMUD.prototype.error = function(text) {
	// Print to debug
	this.debugString(text, 'error');

	// If we have console grouping, log the options.
	if ( 'console' in window && console.groupCollapsed !== undefined ) {
		console.groupCollapsed('DecafMUD['+this.id+'] Instance State');
		console.dir(this);
		console.groupEnd();
	}
	
	// If we have a UI, try splashError.
	if ( this.ui && this.ui.splashError(text) ) { return; }
	
	// TODO: Check the Interface and stuff
	alert("DecafMUD Error\n\n{0}".tr(this,text));
}

///////////////////////////////////////////////////////////////////////////////
// Module Loading
///////////////////////////////////////////////////////////////////////////////

/** Load a script from an external file, using the given path. If a path isn't
 *  provided, find the path to decafmud.js and use that.
 * @param {string} filename The name of the script file to load.
 * @param {string} [path] The path to load the script from.
 * @example
 * decaf.loadScript("my-plugin-stuff.js");
 */
DecafMUD.prototype.loadScript = function(filename, path) {
	if ( path === undefined ) {
		if ( this.options.jslocation !== undefined ) { path = this.options.jslocation; }
		if ( path === undefined || typeof path === 'string' && path.length === 0 ) {
			// Attempt to discover the path.
			var obj = document.querySelector('script[src*="decafmud.js"]');
			if ( obj === null ) {
				obj = document.querySelector('script[src*="decafmud.min.js"]'); }
			if ( obj !== null ) {
				path = obj.src.substr(0,obj.src.lastIndexOf('/')+1); }
		}
	}
	
	// Now that we have a path, create a script element to load our script
	// and add it to the header so that it's loaded.
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = path + filename;
	document.getElementsByTagName('head')[0].appendChild(script);
	
	// Debug that we've loaded it.
	this.debugString('Loading script: ' + filename); // + ' (' + script.src + ')');
}

/** Require a moddule to be loaded. Plugins can call this function to ensure
 *  that their dependencies are loaded. Be sure to use this along with waitLoad
 *  to ensure the modules are loaded before calling code that uses them.
 * @param {String} module The module that has to be loaded.
 * @param {function} [check] If specified, this function will be used to check
 *    that the module is loaded. Otherwise, it will be looked for in the
 *    DecafMUD plugin tree.
 * @example
 * decaf.require('decafmud.encoding.cp437');
 * @example
 * // External module
 * decaf.require('my-module', function() {
 *    return 'SomeRequirement' in window;
 * }); */
DecafMUD.prototype.require = function(module, check) {
	// If we're loading language files, try it.
	if ( this.options.load_language && this.options.language !== 'en' &&
		 module.indexOf('language') === -1 && module.indexOf('decafmud') !== -1 ) {
		var parts = module.split('.');
		parts.splice(1,0,"language",this.options.language);
		this.require(parts.join('.'));
	}
	
	if ( check === undefined ) {
		// Build a checker
		if ( module.toLowerCase().indexOf('decafmud') === 0 ) {
			var parts = module.split('.');
			if ( parts.length < 2 ) { return; } // Already have DecafMUD, duh.
			parts.shift();
			parts[0] = parts[0][0].toUpperCase() + parts[0].substr(1);
			
			// If it's a telopt, search DecafMUD.TN for it.
			if ( parts[0] === 'Telopt' ) {
				for(var k in DecafMUD.TN) {
					if ( parts[1].toUpperCase() === k.toUpperCase() ) {
						parts[1] = DecafMUD.TN[k];
						break; }
				}
			}
			
			check = function() {
				if ( DecafMUD.plugins[parts[0]] !== undefined ) {
					if ( parts.length > 1 ) {
						return DecafMUD.plugins[parts[0]][parts[1]] !== undefined;
					} else { return true; }
				}
				return false;
			};
		} else {
			throw "Can't build checker for non-DecafMUD module!"
		}
	}
	
	// Increment required.
	this.required++;
	
	// Call the checker. If we already have it, return now.
	if ( check.call(this) ) { return; }

	// Load the script.
	/*var decaf = this;
	setTimeout(function() {
		decaf.loadScript(module+'.js');
	},this.required*500);*/
	this.loadScript(module+'.js');
	
	// Finally, push to need for waitLoad to work.
	this.need.push([module,check]);
}

/** Wait for all the currently required modules to load. Then, after everything
 *  has loaded, call the supplied function to continue execution. This function
 *  calls itself on a timer to work without having to block. Since blocking is
 *  evil.
 * @param {function} next The function to call when everything has loaded.
 * @param {function} [itemloaded] If provided, this function will be called
 *    each time a new item has been loaded. Useful for splash screens.
 */
DecafMUD.prototype.waitLoad = function(next, itemloaded, tr) {
	clearTimeout(this.loadTimer);
	
	if ( tr === undefined ) { tr = 0; }
	else if ( tr > this.options.wait_tries ) {
		if ( this.need[0][0].indexOf('language') === -1 ) {
			this.error("Timed out attempting to load the module: {0}".tr(this, this.need[0][0]));
			return;
		} else {
			if ( itemloaded !== undefined ) {
				if ( this.need.length > 1 ) {
					itemloaded.call(this,this.need[0][0], this.need[1][0]);
				} else {
					itemloaded.call(this,this.need[0][0]);
				}
			}
			this.need.shift();
			tr = 0;
		}
	}
	
	while( this.need.length ) {
		if ( typeof this.need[0] === 'string' ) {
			this.need.shift();
		} else {
			if ( this.need[0][1].call(this) ) {
				if ( itemloaded !== undefined ) {
					if ( this.need.length > 1 ) {
						itemloaded.call(this,this.need[0][0], this.need[1][0]);
					} else {
						itemloaded.call(this,this.need[0][0]);
					}
				}
				this.need.shift();
				tr = 0;
			} else { break; }
		}
	}
	
	// If this.need is empty, call next. If not, call it again in a bit.
	if ( this.need.length === 0 ) {
		next.call(this);
	} else {
		var decaf = this;
		this.loadTimer = setTimeout(function(){decaf.waitLoad(next,itemloaded,tr+1)},this.options.wait_delay);
	}
}

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

/** The first step of initialization after loading the user interface. Here, we
 *  create a new instance of the user interface and tell it to show a basic
 *  splash. Then, we start loading the other plugins.
 */
DecafMUD.prototype.initSplash = function() {
	// Create the UI if we're using one. Which we always should be.
	if ( this.options.interface !== undefined ) {
		this.debugString('Attempting to initialize the interface plugin "{0}".'.tr(this,this.options.interface));
		this.ui = new DecafMUD.plugins.Interface[this.options.interface](this);
		this.ui.initSplash();
	}

	// Set the number of extra steps predicted after this step of loading for
	// the sake of updating the progress bar.
	this.extra = 3;
	
	// Require plugins for: storage, socket, encoding, triggers, telopt
	this.require('decafmud.storage.'+this.options.storage);
	this.require('decafmud.socket.'+this.options.socket);
	this.require('decafmud.encoding.'+this.options.encoding);
	
	// Load them. This is the total number of required things thus far.
	if ( this.ui && this.need.length > 0 ) { this.updateSplash(null,this.need[0][0],0); }
	this.waitLoad(this.initSocket, this.updateSplash);
}

/** Update the splash screen as we load. */
DecafMUD.prototype.updateSplash = function(module,next_mod,perc) {
	if ( ! this.ui ) { return; }
	
	// Calculate the percentage.
	if ( perc === undefined ) {
		perc = Math.min(100,Math.floor(100*(((this.extra+this.required)-this.need.length)/(this.required+this.extra)))); }
	
	if ( module === true ) {
		// Don't do anything.
	} else if ( next_mod !== undefined ) {
		if ( next_mod.indexOf('decafmud') === 0 ) {
			var parts = next_mod.split('.');
			next_mod = 'Loading the {0} module "{1}"...'.tr(this, parts[1],parts[2]);
		} else {
			next_mod = 'Loading: {0}'.tr(this,next_mod);
		}
	} else if ( perc == 100 ) {
		next_mod = "Loading complete.".tr(this);
	}
	
	this.ui.updateSplash(perc, next_mod);
	
}

/** The second step of initialization. */
DecafMUD.prototype.initSocket = function() {
	this.extra = 1;
	// Create the master storage object.
	this.store = new DecafMUD.plugins.Storage[this.options.storage](this);
	this.storage = this.store;
	
	if ( this.ui ) {
		// Push a junk element to need so the status bar shows properly.
		this.need.push('.');
		this.updateSplash(true,"Initializing the user interface...".tr(this));
		
		// Set up the UI.
		this.ui.load();
	}
	
	// Attempt to create the socket.
	this.debugString('Creating a socket using the "{0}" plugin.'.tr(this,this.options.socket));
	this.socket = new DecafMUD.plugins.Socket[this.options.socket](this);
	this.socket.setup(0);
	
	// Load the latest round.
	this.waitLoad(this.initUI, this.updateSplash);
}

/** The third step. Now we're creating the UI. */
DecafMUD.prototype.initUI = function() {
	// Finish setting up the UI.
	if ( this.ui ) {
		this.ui.setup(); }
	
	// Now, require all our plugins.
	for(var i=0; i<this.options.plugins.length; i++) {
		this.require('decafmud.'+this.options.plugins[i]); }
	
	this.waitLoad(this.initFinal, this.updateSplash);
}

/** The final step. Instantiate all our plugins. */
DecafMUD.prototype.initFinal = function() {
	this.need.push('.');
	this.updateSplash(true,"Initializing triggers system...");
	this.need.shift();
	
	this.need.push('.');
	this.updateSplash(true,"Initializing TELNET extensions...");
	
	for(var k in DecafMUD.plugins.Telopt) {
		var o = DecafMUD.plugins.Telopt[k];
		if ( typeof o === 'function' ) {
			this.telopt[k] = new o(this);
		} else {
			this.telopt[k] = o;
		}
	}
	
	// Add an About button to the toolbar.
	if ( this.ui.tbNew ) {
		this.ui.tbNew("About".tr(this), function(){ this.decaf.about(); }); }
	
	// We're loaded. Try to connect.
	this.loaded = true;
	this.ui.endSplash();
	
	// If this is IE, show a warning.
	if ( /MSIE/.test(navigator.userAgent) && this.ui.infoBar ) {
		var msg = 'You may experience poor performance and UI glitches using ' +
			'DecafMUD with Microsoft Internet Explorer. We recommend switching ' + 
			'to <a href="http://www.google.com/chrome">Google Chrome</a> or ' +
			'<a href="http://www.getfirefox.com">Mozilla Firefox</a> for ' +
			'the best experience.';
		this.ui.infoBar(msg.tr(this));
	}
	
	if ( (!this.options.autoconnect) || (!this.socket.ready)) { return; }
	this.connect();
}

/** Attempt to connect to the server if we aren't. */
DecafMUD.prototype.connect = function() {
	if ( this.connecting || this.connected ) { return; }
	if ( this.socket_ready !== true ) { throw "The socket isn't ready yet."; }
	
	this.connecting = true;
	this.connect_try = 0;
	this.debugString("Attempting to connect...","info");
	
	// Show that we're connecting
	if ( this.ui && this.ui.connecting ) {
		this.ui.connecting(); }
	
	// Set a timer so we can try again.
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
	
	this.socket.connect();
}

/** Called when the socket doesn't connect in a reasonable time. Resets the
 *  socket to try again. */
DecafMUD.prototype.connectFail = function() {
	clearTimeout(this.conn_timer);
	
	this.cconnect_try += 1;
	// On the last one, just ride it out.
	if ( this.connect_try > this.options.reconnect_tries ) { return; }
	
	// Retry.
	this.socket.close();
	this.socket.connect();
	
	// Set the timer.
	var decaf = this;
	this.conn_timer = setTimeout(function(){decaf.connectFail();},this.options.connect_timeout);
}

///////////////////////////////////////////////////////////////////////////////
// Socket Events
///////////////////////////////////////////////////////////////////////////////

/** Called by the socket when the socket is ready. Make note that the socket is
 *  available, and if desired start trying to connect. */
DecafMUD.prototype.socketReady = function() {
	this.debugString("The socket is ready.");
	this.socket_ready = true;
	
	// If we've loaded, and autoconnect is on, try connecting.
	if ( this.loaded && this.options.autoconnect ) {
		this.connect();
	}
}

/** Called by the socket when the socket connects. */
DecafMUD.prototype.socketConnected = function() {
	this.connecting = false; this.connected = true; this.connect_try = 0;
	clearTimeout(this.conn_timer);
	
	// Get the host and stuff.
	var host = this.socket.host, port = this.socket.port;
	
	this.debugString("The socket has connected successfully to {0}:{1}.".tr(this,host,port),"info");
	
	// Call telopt connected code.
	for(var k in this.telopt) {
		if ( this.telopt[k] && this.telopt[k].connect ) {
			this.telopt[k].connect(); }
	}
	
	// Show that we're connected.
	if ( this.ui && this.ui.connected ) {
		this.ui.connected(); }
	
	//if ( this.display ) {
	//	this.display.message('<b>Connected.</b>'.tr(this,host,port),'decafmud socket status'); }
}

/** Called by the socket when the socket disconnects. */
DecafMUD.prototype.socketClosed = function() {
	clearTimeout(this.conn_timer);
	this.connecting = false; this.connected = false;
	this.debugString("The socket has disconnected.","info");
	
	// Call telopt disconnected code.
	for(var k in this.telopt) {
		if ( this.telopt[k] && this.telopt[k].disconnect ) {
			this.telopt[k].disconnect(); }
	}
	
	// Clear the buffer to ensure we don't enter into a bad state on reconnect.
	this.inbuf = [];
	
	// Should we be reconnecting?
	if ( this.options.autoreconnect ) {
		this.connect_try++;
		if ( this.connect_try < this.options.reconnect_tries ) {
			// Show the message, along with a 'reconnecting...' bit if possible.
			if ( this.ui && this.ui.disconnected ) {
				this.ui.disconnected(true); }
			
			var d = this;
			
			// Show a reconnect infobar
			var s = this.options.reconnect_delay / 1000;
			if ( this.ui && this.ui.immediateInfoBar && s >= 0.25 ) {
				this.ui.immediateInfoBar("You have been disconnected. Reconnecting in {0} second{1}...".tr(this, s, (s === 1 ? '' : 's')),
					'reconnecting',
					s,
					undefined,
					[['Reconnect Now'.tr(this),function(){ clearTimeout(d.timer); d.socket.connect(); }]],
					undefined,
					function(){ clearTimeout(d.timer);  }
				); }
			
			this.timer = setTimeout(function(){
				d.debugString('Attempting to connect...','info');
				if ( d.ui && d.ui.connecting ) {
					d.ui.connecting(); }
				d.socket.connect();
			}, this.options.reconnect_delay);
			return;
		}
	}
	
	// Show that we disconnected.
	if ( this.ui && this.ui.disconnected ) {
		this.ui.disconnected(false); }
}

/** Called by the socket when data arrives. */
DecafMUD.prototype.socketData = function(data) {
	// Push the text onto the inbuf.
	this.inbuf.push(data);
	
	// If we've finished loading, handle it.
	if ( this.loaded ) {
		this.processBuffer();
	}
}

/** Called by the socket when there's an error. */
DecafMUD.prototype.socketError = function(data,data2) {
	this.debugString('Socket Err: {0}  d2="{1}"'.tr(this,data,data2),'error');
}

///////////////////////////////////////////////////////////////////////////////
// Data Processing
///////////////////////////////////////////////////////////////////////////////

/** Get an internal incoder from a formatted name. */
DecafMUD.prototype.getEnc = function(enc) {
	enc = enc.replace(/-/g,'').toLowerCase();
	return enc;
}

/** Change the active encoding scheme to the provided scheme.
 * @param {String} enc The encoding scheme to use. */
DecafMUD.prototype.setEncoding = function(enc) {
	enc = this.getEnc(enc);

	if ( DecafMUD.plugins.Encoding[enc] === undefined ) {
		throw '"'+enc+"' isn't a valid encoding scheme, or it isn't loaded."; }
	
	this.debugString("Switching to character encoding: " + enc);
	this.options.encoding = enc;
	
	// Now, reroute functions for speed.
	this.decode = DecafMUD.plugins.Encoding[enc].decode;
	this.encode = DecafMUD.plugins.Encoding[enc].encode;
}

var iac_reg = /\xFF/g;
/** Send input to the MUD, as if typed by a player. This means it also goes out
 *  to the display and stuff. Escape any IAC bytes.
 * @param {String} input The input to send to the server. */
DecafMUD.prototype.sendInput = function(input) {
	if ( ! this.socket ) { throw "We don't have a socket yet. Just wait a bit!"; }
	this.socket.write(this.encode(input + '\r\n').replace(iac_reg, '\xFF\xFF'));
	
	if ( this.ui ) {
		this.ui.displayInput(input); }
}

/** This function is a mere helper for decoding. It'll be overwritten. */
DecafMUD.prototype.decode = function(data) {
	return DecafMUD.plugins.Encoding[this.options.encoding].decode(data); }

/** This function is a mere helper for encoding. It'll be overwritten. */
DecafMUD.prototype.encode = function(data) {
	return DecafMUD.plugins.Encoding[this.options.encoding].encode(data); }

/** Read through data, only stopping for TELNET sequences. Pass data through to
 *  the display handler. */
DecafMUD.prototype.processBuffer = function() {
	if ( ! this.display ) { return; }
	
	var data = this.inbuf.join(''), IAC = DecafMUD.TN.IAC, left='';
	this.inbuf = [];
	
	// Loop through the string.
	while ( data.length > 0 ) {
		var ind = data.indexOf(IAC);
		if ( ind === -1 ) {
			var enc = this.decode(data);
			
			
			
			this.display.handleData(enc[0]);
			this.inbuf.splice(1,0,enc[1]);
			break;
		}
		
		else if ( ind > 0 ) {
			var enc = this.decode(data.substr(0,ind));
			this.display.handleData(enc[0]);
			left = enc[1];
			data = data.substr(ind);
		}
		
		var out = this.readIAC(data);
		if ( out === false ) {
			// Ensure old data goes to the very beginning.
			this.inbuf.splice(1,0,left + data);
			break;
		}
		data = left + out;
	}
}

/** Read an IAC sequence from the supplied data. Then return either the remaining
 *  data, or if a full sequence can't be read, return false.
 * @param {String} data The data to read a sequence from.
 * @returns {String|boolean} False if we can't read a sequence, else the
 *    remaining data. */
DecafMUD.prototype.readIAC = function(data) {
	if ( data.length < 2 ) { return false; }
	
	// If the second character is IAC, push an IAC to the display and return.
	else if ( data.charCodeAt(1) === 255 ) {
		this.display.handleData('\xFF');
		return data.substr(2);
	}
	
	// If the second character is a GA or NOP, ignore it.
	else if ( data.charCodeAt(1) === 249 || data.charCodeAt(1) === 241 ) {
		return data.substr(2);
	}
	
	// If the second character is one of WILL,WONT,DO,DONT, read it, debug,
	// and handle it.
	else if ( "\xFB\xFC\xFD\xFE".indexOf(data.charAt(1)) !== -1 ) {
		if ( data.length < 3 ) { return false; }
		var seq = data.substr(0,3);
		this.debugString('RCVD ' + DecafMUD.debugIAC(seq));
		this.handleIACSimple(seq);
		return data.substr(3);
	}
	
	// If it's an IAC SB, read as much as we can to get it all.
	else if ( data.charAt(1) === t.SB ) {
		//this.debugString('RCVD ' + DecafMUD.debugIAC(data.substr(0,10)));
		var seq = '', l = t.IAC + t.SE;
		var code = data.charAt(2);
		data = data.substr(3);
		if ( data.length === 0 ) { return false; }
		while(data.length > 0) {
			var ind = data.indexOf(l);
			if ( ind === -1 ) { return false; }
			if ( ind > 0 && data.charAt(ind-1) === t.IAC ) {
				// Escaped. Continue
				seq += data.substr(0,ind+1);
				data = data.substr(ind+1);
				continue;
			}
			
			seq += data.substr(0,ind);
			data = data.substr(ind+1);
			break;
		}
		
		var dbg = true;
		
		if ( this.telopt[code] !== undefined && this.telopt[code]._sb !== undefined ) {
			if ( this.telopt[code]._sb(seq) === false ) { dbg = false; }
		}
		
		if ( dbg ) {
			if ( code === t.MSSP && console.groupCollapsed !== undefined ) {
				console.groupCollapsed('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
				console.dir(readMSDP(seq)[0]);
				console.groupEnd('DecafMUD['+this.id+']: RCVD IAC SB MSSP ... IAC SE');
			} else {
				this.debugString('RCVD ' + DecafMUD.debugIAC(t.IAC + t.SB + code + seq + t.IAC + t.SE));
			}
		}
	}
	
	// Just push the IAC off the stack since it's obviously bad.
	return data.substr(1);
}

/** Send a telnet sequence, writing it to debug as well.
 * @param {String} seq The sequence to write out. */
DecafMUD.prototype.sendIAC = function(seq) {
	this.debugString('SENT ' + DecafMUD.debugIAC(seq));
	if ( this.socket ) { this.socket.write(seq); }
}

/** Handle a simple (DO/DONT/WILL/WONT) IAC sequence.
 * @param {String} seq The sequence to handle. */
DecafMUD.prototype.handleIACSimple = function(seq) {
	var t = DecafMUD.TN, o = this.telopt[seq.charAt(2)],
		c = seq.charAt(2);
	// Ensure we actually have this option to deal with.
	if ( o === undefined ) {
		if ( seq.charAt(1) === t.DO ) {
			this.sendIAC(t.IAC + t.WONT + c); }
		else if ( seq.charAt(1) === t.WILL ) {
			this.sendIAC(t.IAC + t.DONT + c); }
		return;
	}
	
	switch(seq.charAt(1)) {
		case t.DO:
			if (!( o._do && o._do() === false )) {
				this.sendIAC(t.IAC + t.WILL + c); }
			return;
		
		case t.DONT:
			if (!( o._dont && o._dont() === false )) {
				this.sendIAC(t.IAC + t.WONT + c); }
			return;
		
		case t.WILL:
			if (!( o._will && o._will() === false )) {
				this.sendIAC(t.IAC + t.DO + c); }
			return;
		
		case t.WONT:
			if (!( o._wont && o._wont() === false )) {
				this.sendIAC(t.IAC + t.DONT + c); }
			return;
	}
}

///////////////////////////////////////////////////////////////////////////////
// Basic Permissions
///////////////////////////////////////////////////////////////////////////////

/** Request permission for a given option, as stored in the global settings
 *  object at the given path. This will ask the user if they want to allow
 *  an action or not, provided they haven't given an answer in the past.
 *
 *  Since the user input may take some time, this will call the provided
 *  callback function with the result when the user makes a decision.
 *
 * @param {String} option The path to the option to check.
 * @param {String} prompt The question to show to the user, asking them if it's
 *    alright to do whatever it is you're doing.
 * @param {function} callback The function to call when we have an answer. */
DecafMUD.prototype.requestPermission = function(option, prompt, callback) {
	var cur = this.store.get(option);
	if ( cur !== undefined && cur !== null ) {
		callback.call(this, !!(cur));
		return; }
	
	var decaf = this;
	var closer = function(e) {
			// Don't store a setting for next time, but return false for now.
			callback.call(decaf, false);
		},
		help_allow = function() {
			decaf.store.set(option, true);
			callback.call(decaf, true);
		},
		help_deny = function() {
			decaf.store.set(option, false);
			callback.call(decaf, false);
		};
	
	// First, check for infobars in the UI. That's preferred.
	if ( this.ui && this.ui.infoBar ) {
		this.ui.infoBar(prompt, 'permission', 0, undefined,
			[['Allow'.tr(this), help_allow], ['Deny'.tr(this), help_deny]], undefined, closer);
		return; }
	
}

///////////////////////////////////////////////////////////////////////////////
// Default Settings
///////////////////////////////////////////////////////////////////////////////
DecafMUD.settings = {
	// Absolute Basics
	'startup': {
		'_path': "/",
		'_desc': "Control what happens when DecafMUD is opened.",
		
		'autoconnect': {
			'_type': 'boolean',
			'_desc': 'Automatically connect to the server.'
		},
		
		'autoreconnect': {
			'_type': 'boolean',
			'_desc': 'Automatically reconnect when the connection is lost.'
		}
	},
	
	'appearance': {
		'_path': "display/",
		'_desc': "Control the appearance of the client.",
		
		'font': {
			'_type': 'font',
			'_desc': 'The font to display MUD output in.'
		}
	}
};

///////////////////////////////////////////////////////////////////////////////
// Default Options
///////////////////////////////////////////////////////////////////////////////
DecafMUD.options = {
	// Connection Basics
	host			: undefined, // undefined = Website's Host
	port			: 4000,
	autoconnect		: true,
	connectonsend	: true,
	autoreconnect	: true,
	connect_timeout : 5000,
	reconnect_delay	: 5000,
	reconnect_tries	: 3,
	
	// Plugins to use
	storage			: 'standard',
	display			: 'standard',
	encoding		: 'iso88591',
	socket			: 'flash',
	interface		: 'simple',
	language		: 'autodetect',
	
	// Loading Settings
	jslocation		: undefined, // undefined = This script's location
	wait_delay		: 25,
	wait_tries		: 1000,
	load_language	: true,
	plugins			: [],
	
	// Storage Settings
	set_storage		: {
		// There are no settings. Yet.
	},
	
	// Display Settings
	set_display		: {
		handlecolor	: true,
		fgclass		: 'c',
		bgclass		: 'b',
        fntclass    : 'fnt',
		inputfg		: '-7',
		inputbg		: '-0'
	},
	
	// Socket Settings
	set_socket		: {
		// Flash Specific
		policyport	: undefined, // Undefined = 843
		swf			: '/media/DecafMUDFlashSocket.swf',
		
		// WebSocket Specific
		wsport		: undefined, // Undefined = Flash policy port
		wspath		: '',
	},
	
	// Interface Settings
	set_interface	: {
		// Elements
		container	: undefined,
		
		// Fullscreen
		start_full	: false,
		
		// Input Specific
		mru			: true,
		mru_size	: 15,
		multiline	: true,
		clearonsend	: false,
		focusinput	: true,
		blurclass	: 'mud-input-blur',
		
		msg_connect		: 'Press Enter to connect and type here...',
		msg_connecting	: 'DecafMUD is attempting to connect...',
		msg_empty		: 'Type commands here, or use the Up and Down arrows to browse your recently used commands.'
	},
	
	// Telnet Settings
	ttypes			: ['decafmud-'+DecafMUD.version,'decafmud','xterm','unknown'],
	environ			: {},
	encoding_order	: ['utf8'],
	
	// Plugin Settings
	plugin_order	: []
};

// Expose DecafMUD to the outside world
window.DecafMUD = DecafMUD;
})(window);
