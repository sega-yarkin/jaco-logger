/**
 * @fileOverview
 * Formatter functions.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 */

'use strict';


//
//   Format
//

let formatDate   = require( './format-date' );
let formatNumber = require( './format-number' );


module.exports = function format( v, args ) {
	if( v instanceof Date ) {
		return formatDate( v, args );
	}
	else if( typeof(v)==='number' || !isNaN(+v) ) {
		return formatNumber( v, args );
	}
	else {
		return (v && typeof(v.toString)==='function' )
			? v.toString()
			: String( v );
	}
};
