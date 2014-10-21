/**
 * @fileOverview
 * Align formatter.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 */

'use strict';


module.exports = function align( v, args ) {
	
	let str   = typeof(v)==='string' ? v : ( v && v.toString ) ? v.toString() : ''
	  , width = ( args.width ) ? args.width : str.length
	  , pad   =   width - str.length
	  , flr   =   args.filler;
	
	if( pad<0 && !args.crop ) {
		width = str.length;
	}
	while( pad > 1 ) {
		flr = flr + flr;
		pad = (pad>>1) + pad%2;
	}
	
	if( args.right ) {
		str = (flr + str);
		if( str.length > width )
			str = str.slice( -width );
	}
	else {
		str = (str + flr);
		if( str.length > width )
			str = str.substr( 0, width );
	}
	
	return str;
};

module.exports.prepareArgs = function prepareArgs( args ) {
	// accepted args:
	//  * s {String}  [side='left'] <= [left|right]
	//  * w {Number}   width
	//  * c {Boolean} [crop=no]     <= [no|yes]
	//  * f {String}  [filler=' ']
	
	let new_args = {
		'right' : ( typeof(args.s)==='string'
		          && (args.s==='right' || args.s.trim().toLowerCase()==='right') ),
		'width' : +args.w || 0,
		'crop'  : ( typeof(args.c)==='string'
		            && (args.c==='yes' || args.c.trim().toLowerCase()==='yes') ),
		'filler': ( typeof(args.f)==='string' ) ? args.f : ' '
	};
	return new_args;
};
