/**
 * @fileOverview
 * Formatter functions main file.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 */

'use strict';


//
// NOTE:
//      Formatter function must conform to the following pattern:
//
//              function ( incoming_object, incoming_parameters_as_object )
//                      return result_object;
//

module.exports = {
	'format': require( './format' ),
	'align' : require( './align'  )
};
