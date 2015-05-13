/**
 * @fileOverview
 * Formatter functions.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 * Formats:
 *   '(...)' - absolute value
 *   '0,0'      -> 1,000
 *   '0.000'    -> 1000.000
 *   '0[.000]'  -> 1000 1000.2 10.235
 *   '0,0[.00]' -> 10.2 12,346.17 0.12
 *
 */

'use strict';

let cache = {};

function compileNumberFormat( f ) {
	let f_ = f;
	f = f.trim();
	let opts = {
		abs: false,
		percent: false,
		thousands: false,
		precision: {
			min: 0,
			max: 0
		}
	};
	//
	// Parse format
	if( f[0]==='(' && f[f.length-1]===')' ) {
		opts.abs = true;
		f = f.substring( 1, f.length-1 );
	}
	if( f[f.length-1] === '%' ) {
		opts.percent = true;
		f = f.substring( 0, f.length-1 );
	}
	let re = /(\d*\,)?(\d+)(\.\d*)?(\[[\d\.]+\])?/;
	let m = f.match( re );
	if( m[1] ) {
		opts.thousands = true;
	}
	if( m[3] ) {
		let idx = m[3].indexOf('.');
		if( m[3][0]==='[' ) {
			opts.precision.max = m[3].length-1 - (idx+1);
		}
		else {
			opts.precision.min = opts.precision.max = m[3].length - (idx+1);
		}
		if( m[4] ) {
			opts.precision.max += m[4].length-2;
		}
	}
	else if( m[4] ) {
		let idx = m[4].indexOf('.');
		opts.precision.max = m[4].length-1 - (idx+1);
	}
	//
	// Make function
	let fn = ""
	  , power = Math.pow( 10, opts.precision.max );
	fn += "  'use strict';\n";
	fn += "  var re, dot;\n";
	fn += "  v = +v || 0;\n";
	if( opts.abs ) {
		fn += "  v = Math.abs( v );\n";
	}
	if( opts.percent ) {
		fn += "  v = v * 100;\n";
	}
	
	fn += "  v = (Math.round( v * " + power + " ) / " + power + ").toString();\n";
	fn += "  dot = v.indexOf('.');\n";
	fn += "  if( dot === -1 ) { v += '.0'; dot = v.length-2; }\n";
	//fn += "  v = v.toFixed( " + opts.precision.max + " );\n";
	fn += "  v = v + '" + (new Array(opts.precision.max+1)).join('0') + "';\n";
	fn += "  v = v.substring( 0, dot+1+" + opts.precision.max + " );\n";
	if( opts.precision.min < opts.precision.max ) {
		let var_digits = opts.precision.max - opts.precision.min;
		fn += "  re = /0{1," + var_digits + "}$/;\n";
		fn += "  v = v.replace( re, '' );\n";
	}
	if( opts.thousands ) {
		fn += "  re = /(\\d)(?=(\\d{3})+(?!\\d))/g\n";
		fn += "  v = v.replace( re, '$1,' );\n";
	}
	//fn += "  \n";
	fn += "  return v;\n";
	fn = new Function( "v", fn );
	cache[f_] = fn;
};

module.exports = function formatNumber( v, args ) {
	// accepted args:
	//  * f ({String} format)
	
	let f = args['f'];
	if( ! f ) {
		return '';
	}
	
	if( ! cache[f] ) {
		compileNumberFormat( f );
	}
	return cache[f]( v );
};

