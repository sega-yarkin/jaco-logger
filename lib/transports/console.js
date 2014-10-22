/**
 * @fileOverview
 * Console transport.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 * 
 */

'use strict';

let util          = require( 'util' );
let JacoTransport = require( '../transport.js' );


util.inherits( JacoTransportConsole, JacoTransport );
function JacoTransportConsole( jaco, root, route, old_route ) {
	let e = JacoTransport.call( this, jaco, root, route );
	if( e instanceof Error )
		return e;
}
JacoTransportConsole.prototype.name = "console";

JacoTransportConsole.prototype.out = function out( vars, callback ) {
	let jaco   = this.parent;
	let format = this.format || jaco.format;
	let str = jaco.formats[ format ]( vars, jaco.formatters, jaco.getVar );
	console.log( str );
	callback();
};


module.exports = JacoTransportConsole;
