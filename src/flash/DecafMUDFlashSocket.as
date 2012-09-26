/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 * 
 * Flash Socket
 * 
 * This is the Flash socket itself that's used by DecafMUD for connecting to
 * remote servers, with support for MCCPv2 to safe bandwidth.
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 */

package {
	// zlib Includes
	import com.wizhelp.fzlib.FZlib;
	import com.wizhelp.fzlib.ZStream;
	
	import flash.display.Sprite;
	import flash.external.ExternalInterface;
	import flash.events.*;
	import flash.net.Socket;
	import flash.system.Security;
	import flash.utils.ByteArray;
	import com.hurlant.crypto.tls.TLSConfig;
	import com.hurlant.crypto.tls.TLSEngine;
	import com.hurlant.crypto.tls.TLSSecurityParameters;
	import com.hurlant.crypto.tls.TLSSocket;

	public class DecafMUDFlashSocket extends Sprite {
		protected var socket:Socket;
		protected var rawsocket:Socket;
		protected var tlsconfig:TLSConfig;
		protected var tlssocket:TLSSocket;
		protected var id:String;
		protected var pport:int;
		protected var callback:String;
		protected var ssl:Boolean;
		protected var host:String;
		
		// Slash Reg
		protected var bsreg:RegExp = new RegExp("\\\\","g");
		
		// MCCP matching.
		protected var comp_reg:RegExp = new RegExp(
			"\xFF(?:[\xFB-\xFE][\x55\x56]|\xFA(?:\x55\xFB\xF0|\x56\xFF\xF0))");
		
		// zlib storage
		protected var total:int;
		protected var inbuf:ByteArray;
		protected var decompressor:ZStream;
		protected var mccp_level:int = 0;
		protected var mccp_remote:Boolean = false;
		public var allow_compress:Boolean = true;

		public function DecafMUDFlashSocket():void {
			// Pass exceptions between Flash and the browser
			flash.external.ExternalInterface.marshallExceptions = true;

			// Get our object's ID.
			var url:String = root.loaderInfo.url;
			id = url.substr(url.lastIndexOf("?") + 1);

			// Set the callback.
			callback = "DecafMUDFlashSocket.flashCallback";

			// Create the socket.
			rawsocket = new Socket  ;

			// Add event listeners to the socket
			rawsocket.addEventListener("close",onClose);
			rawsocket.addEventListener("connect",onConnect);
			rawsocket.addEventListener("ioError",onError);
			rawsocket.addEventListener("securityError",onSecurityError);

			// Set the default pport
			pport = 843;

			// Add the ExternalInterface callbacks.
			flash.external.ExternalInterface.addCallback("setPolicyPort",setPolicyPort);
			flash.external.ExternalInterface.addCallback("connect",connect);
			flash.external.ExternalInterface.addCallback("close",close);
			flash.external.ExternalInterface.addCallback("write",write);

			// If allow_compress is True, initialize the decompressor.
			if ( allow_compress ) {
				inbuf = new ByteArray();
				decompressor = new ZStream();
			}
			
			// Call a callback to let JavaScript know we're ready.
			flash.external.ExternalInterface.call(callback,id,0);
		}

		protected function onClose(event:Event):void {
			flash.external.ExternalInterface.call(callback,id,2);
			socket.close();
			
			// Cleanup the decompressor
			cleanupMCCP(true);
		}
		
		protected function cleanupMCCP(buf:Boolean = false):void {
			decompressor = new ZStream();
			mccp_level = 0;
			mccp_remote = false;
			if ( buf === true )
				inbuf = new ByteArray();
		}

		protected function onConnect(event:Event):void {
			if(ssl) {
				tlssocket.startTLS(rawsocket, host, tlsconfig);
			}
			flash.external.ExternalInterface.call(callback,id,1);
		}

		protected function onError(event:IOErrorEvent):void {
			flash.external.ExternalInterface.call(callback,id,3,event.type,event.text);
		}

		protected function onSecurityError(event:SecurityErrorEvent):void {
			flash.external.ExternalInterface.call(callback,id,3,event.type,event.text);
		}

		protected function onSocketData(event:ProgressEvent):void {
			var available:int, c:int;
			
			// Are we allowed to compress?
			if ( !allow_compress ) {
				var out:String = '';
				while ( socket.bytesAvailable > 0 ) {
					c = socket.readUnsignedByte();
					if ( c == 0 )
						c = 0xE000;
					out += String.fromCharCode(c);
				}
				flash.external.ExternalInterface.call(callback,id,4,out.replace(bsreg,"\\\\"));
				return;
			}
			
			// Nope. Read to inbuf.
			while ( socket.bytesAvailable > 0 ) {
				c = socket.readUnsignedByte();
				inbuf.writeByte(c);
			}
			
			// Process it.
			processMCCP();
		}
		
		protected function processMCCP():void {
			var err:int, c:int, output:ByteArray;

			// Set the inbuf pointer back to 0.
			inbuf.position = 0;

			// If MCCP is enabled, decompress the text.
			if ( mccp_remote ) {
				output = new ByteArray();
				
				total += inbuf.bytesAvailable;
				
				// Send the bytes through the decompressor.
				decompressor.next_in		= inbuf;
				decompressor.next_out		= output;
				decompressor.avail_in		= inbuf.bytesAvailable;
				decompressor.avail_out		= 40000;
				
				decompressor.next_in_index	= 0;
				decompressor.next_out_index	= 0;
				
				// Attempt decompression.
				//err = decompressor.inflate(FZlib.Z_SYNC_FLUSH);
				err = decompressor.inflate(FZlib.Z_PARTIAL_FLUSH);
				
				// Was it successful?
				if ( err != FZlib.Z_BUF_ERROR && err != FZlib.Z_OK && err != FZlib.Z_STREAM_END ) {
					// Error.
					if ( decompressor.msg != null )
						flash.external.ExternalInterface.call(callback,id,3,"zlib",decompressor.msg);
				
					socket.close();
					cleanupMCCP(true);
					flash.external.ExternalInterface.call(callback,id,3,"zlib",err);
					flash.external.ExternalInterface.call(callback,id,2);
					return;
				}
				
				// Is the stream over?
				if ( err == FZlib.Z_STREAM_END ) {
					flash.external.ExternalInterface.call(callback,id,5,"zlib","compression done");
					
					// Flush as much as we can.
					inbuf.position = decompressor.next_in_index;
					inbuf.readBytes(output);
					
					err = decompressor.inflateEnd();
					flash.external.ExternalInterface.call(callback,id,5,"zlib-end",err);
					
					cleanupMCCP();
				}
				
				// Set inbuf to our output.
				inbuf = output;
			}
			
			// Convert our data to a string.
			var out:String = '';
			inbuf.position = 0;
			while ( inbuf.bytesAvailable > 0 ) {
				c = inbuf.readUnsignedByte();
				if ( c == 0 )
					c = 0xE000;
				out += String.fromCharCode(c);
			}
			
			// Check the data for MCCP negotiation.
			var m:Object = comp_reg.exec(out);
			if ( m != null ) {
				// We have a negotiation. First, send the text up to the negotiation to the
				// client.
				flash.external.ExternalInterface.call(callback,id,4,out.slice(0, m.index).replace(bsreg,"\\\\"));
				
				// Send debug info to the client.
				flash.external.ExternalInterface.call(callback,id,5,'mccp',m[0]);
				
				// Determine what to do.
				var this_mccp:int = 0;
				if ( m[0].charCodeAt(2) == 86 )
					this_mccp = 2;
				else
					this_mccp = 1;
				
				// IAC + WILL
				if ( m[0].charCodeAt(1) == 251 ) {
					if ( mccp_level == 0 || mccp_level == this_mccp ) {
						// Send IAC + DO + COMPRESS(v2)
						flash.external.ExternalInterface.call(callback,id,5,'mccp-out','\xFF\xFD'+m[0].charAt(2));
						socket.writeByte(255);
						socket.writeByte(253);
						socket.writeByte(m[0].charCodeAt(2));
						socket.flush();
						mccp_level = this_mccp;
					} else {
						// Send IAC + DONT + COMPRESS(v2)
						flash.external.ExternalInterface.call(callback,id,5,'mccp-out','\xFF\xFE'+m[0].charAt(2));
						socket.writeByte(255);
						socket.writeByte(254);
						socket.writeByte(m[0].charCodeAt(2));
						socket.flush();
					}
				}
				
				// IAC + WONT
				else if ( m[0].charCodeAt(1) == 252 && mccp_level == this_mccp )
					mccp_level = 0;
				
				// SB
				else if ( m[0].charCodeAt(1) == 250 ) {
					if ( !mccp_remote ) {
						// Start the compressed stream.
						mccp_remote = true;
						total = 0;
						err = decompressor.inflateInit();
						if ( err != FZlib.Z_OK )
							flash.external.ExternalInterface.call(callback,id,5,"zlib",err);
						flash.external.ExternalInterface.call(callback,id,5,"Starting MCCP.",mccp_level);
					} else {
						flash.external.ExternalInterface.call(callback,id,5,"MCCP was already started!","warning");
					}
				}
				
				// Update the input buffer.
				output = new ByteArray();
				inbuf.position = m.index + m[0].length;
				while ( inbuf.bytesAvailable > 0 )
					output.writeByte(inbuf.readUnsignedByte());
				inbuf = output;
				processMCCP();
			} else {
				// No negotiation. Send the full text.
				flash.external.ExternalInterface.call(callback,id,4,out.replace(bsreg,'\\\\'));
				inbuf = new ByteArray();
			}
			
		}

		public function setPolicyPort(port:int):void {
			pport=port;
		}

		public function setMCCP(allow:Boolean):void {
			allow_compress = allow;
		}

		public function connect(wshost:String,wsport:int,use_ssl:Boolean):void {
			// First, load the policy file.
			if (pport!=843) {
				Security.loadPolicyFile("xmlsocket://"+wshost+":"+pport);
			}

			// Connect.
			host = wshost;
			if (use_ssl) {
				ssl = use_ssl;
				tlsconfig= new TLSConfig(TLSEngine.CLIENT,
					null, null, null, null, null,
					TLSSecurityParameters.PROTOCOL_VERSION);
				tlsconfig.trustAllCertificates = true;
				tlsconfig.ignoreCommonNameMismatch = true;
				tlssocket = new TLSSocket();
				tlssocket.addEventListener("socketData",onSocketData);
                                socket = tlssocket;
			} else {
				rawsocket.addEventListener("socketData",onSocketData);
				socket = rawsocket;
			}
			rawsocket.connect(wshost,wsport);
		}

		public function close():void {
			socket.close();
			cleanupMCCP(true);
		}

		public function write(msg:String):void {
			var c:int;
			for (var i:int=0; i<msg.length; ++i) {
				c = msg.charCodeAt(i);
				if (c == 0xE000) {
					c = 0;
				}
				socket.writeByte(c);
			}
			socket.flush();
		}
	}
}
