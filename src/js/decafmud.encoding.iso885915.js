/*!
 * DecafMUD v0.9.0
 * http://decafmud.kicks-ass.net
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

 /**
 * @fileOverview DecafMUD Character Encoding: ISO-8859-15
 * @author Stendec <stendec365@gmail.com>
 * @version 0.9.0
 */

(function(DecafMUD) {

// ISO-8859-1 --> ISO-8859-15
var replaces = {
	'\xA4': '\u20AC',
	'\xA6': '\u0160',
	'\xA8': '\u0161',
	'\xB4': '\u017D',
	'\xB8': '\u017E',
	'\xBC': '\u0152',
	'\xBD': '\u0153',
	'\xBE': '\u0178'
}

// Reverse the array for ISO-8859-15 --> ISO-8859-1
// Also, build our regexes.
var rep_reg = '[', unrep_reg = '[';
var unreplaces = {};
for(var k in replaces) {
	rep_reg += k;
	unrep_reg += replaces[k];
	unreplaces[replaces[k]] = k; }

// Build regexes
rep_reg = new RegExp(rep_reg+']',"g");
unrep_reg = new RegExp(unrep_reg+']',"g");

var decode = function(data) {
		return [data.replace(rep_reg, function(m) { return replaces[m]; }), ''];
	},
	
	encode = function(data) {
		return data.replace(unrep_reg, function(m) { return unreplaces[m]; });
	};

// Expose to DecafMUD.
/** This provides support for the <a href="http://en.wikipedia.org/wiki/ISO/IEC_8859-15">ISO-8859-15</a>
 *  character encoding to DecafMUD by translating the different characters into
 *  their unicode equivilents.
 * @example
 * alert(DecafMUD.plugins.Encoding.iso885915.decode("This is some text!"));
 * @namespace DecafMUD Character Encoding: ISO-8859-15 */
DecafMUD.plugins.Encoding.iso885915 = {
	proper : 'ISO-8859-15',
	
	/** Replace ISO-8859-15 encoded characters with their unicode equivilents.
	 * @example
	 * DecafMUD.plugins.Encoding.iso885915.decode("\xA4");
	 * // Becomes: "\u20AC"
	 * @function
	 * @param {String} data The text to decode. */
	decode: decode,
	
	/** Replace the unicode equivilents of ISO-8859-15 characters with their
	 *  ISO-8859-15 values.
	 * @example
	 * DecafMUD.plugins.Encoding.iso885915.encode("\u20AC")
	 * // Becomes: "\xA4"
	 * @function
	 * @param {String} data The text to encode. */
	encode: encode
};

})(DecafMUD);