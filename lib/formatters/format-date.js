/**
 * @fileOverview
 * Formatter functions.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 * Format options:
 *   * borrowed from Steven Levithan's dateFormat()
 *   * http://blog.stevenlevithan.com/archives/date-time-format 
 *
 *  Day:
 *    d		Day of the month as digits; no leading zero for single-digit days.
 *    dd	Day of the month as digits; leading zero for single-digit days.
 *    ddd	Day of the week as a three-letter abbreviation.
 *    dddd	Day of the week as its full name.
 *
 *  Month:
 *    m		Month as digits; no leading zero for single-digit months.
 *    mm	Month as digits; leading zero for single-digit months.
 *    mmm	Month as a three-letter abbreviation.
 *    mmmm	Month as its full name.
 *
 *  Year:
 *    yy	Year as last two digits; leading zero for years less than 10.
 *    yyyy	Year represented by four digits.
 *
 *  Hours:
 *    h		Hours; no leading zero for single-digit hours (12-hour clock).
 *    hh	Hours; leading zero for single-digit hours (12-hour clock).
 *    H		Hours; no leading zero for single-digit hours (24-hour clock).
 *    HH	Hours; leading zero for single-digit hours (24-hour clock).
 *
 *  Minutes:
 *    M		Minutes; no leading zero for single-digit minutes.
 *    MM	Minutes; leading zero for single-digit minutes.
 *
 *  Seconds:
 *    s		Seconds; no leading zero for single-digit seconds.
 *    ss	Seconds; leading zero for single-digit seconds.
 *
 *  Milliseconds:
 *    l		Milliseconds; 3 digits.
 *    L		Milliseconds; 2 digits.
 *
 *  Marker string:
 *    tv	Lowercase, single-character time marker string: a or p.
 *    tt	Lowercase, two-character time marker string: am or pm.
 *    T		Uppercase, single-character time marker string: A or P.
 *    TT	Uppercase, two-character time marker string: AM or PM.
 *
 *  Timezones:
 *    Z		US timezone abbreviation, e.g. EST or MDT. With non-US timezones,
 *    		the GMT/UTC offset is returned, e.g. GMT-0500.
 *    o		GMT/UTC timezone offset, e.g. -0500 or +0230.
 *    UTC:	Must be the first four characters of the format string.
 *    		Converts the date from local time to UTC/GMT/Zulu time before applying the mask.
 *    		The "UTC:" prefix will removed.
 *
 *  Others:
 *    S		The date's ordinal suffix (st, nd, rd, or th). Works well with d.
 *    '…', "…" 	Literal character sequence. Surrounding quotes will removed.
 * 
 */

'use strict';


let cache = {};
let i18n = {
	'dayNames': {
		'short': [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ],
		'full' : [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ]
	},
	'monthNames': {
		'short': [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ],
		'full' : [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ]
	}
};

function compileDateFormat( f ) {
	function escapeQuotes( str ) {
		return str.replace( '\'', '\\\'' )
		          .replace( '\"', '\\\"' );
	}
	function getToken( t, utc ) {
		let pref = utc ? "getUTC" : "get";
		switch( t ) {
			case 'yy'  : return "pad2(v."+pref+"FullYear() % 100)";
			case 'yyyy': return "v."+pref+"FullYear()";
			case 'm'   : return "v."+pref+"Month()+1";
			case 'mm'  : return "pad2(v."+pref+"Month()+1)";
			case 'mmm' : return "i18n.monthNames.short[v."+pref+"Month()]";
			case 'mmmm': return "i18n.monthNames.full[v."+pref+"Month()]";
			case 'd'   : return "v."+pref+"Date()";
			case 'dd'  : return "pad2(v."+pref+"Date())";
			case 'ddd' : return "i18n.dayNames.short[v."+pref+"Day()]";
			case 'dddd': return "i18n.dayNames.full[v."+pref+"Day()]";
			case 'h'   : return "v."+pref+"Hours()%12||12";
			case 'hh'  : return "pad2(v."+pref+"Hours()%12||12)";
			case 'H'   : return "v."+pref+"Hours()";
			case 'HH'  : return "pad2(v."+pref+"Hours())";
			case 'M'   : return "v."+pref+"Minutes()";
			case 'MM'  : return "pad2(v."+pref+"Minutes())";
			case 's'   : return "v."+pref+"Seconds()";
			case 'ss'  : return "pad2(v."+pref+"Seconds())";
			case 'l'   : return "pad3(v."+pref+"Milliseconds())";
			case 'L'   : return "pad2(v."+pref+"Milliseconds()/10)";
			case 't'   : return "v."+pref+"Hours() < 12 ? 'a' : 'p'";
			case 'tt'  : return "v."+pref+"Hours() < 12 ? 'am' : 'pm'";
			case 'T'   : return "v."+pref+"Hours() < 12 ? 'A' : 'P'";
			case 'TT'  : return "v."+pref+"Hours() < 12 ? 'AM' : 'PM'";
			case 'Z'   : return (utc) ? "UTC" : "(String(v).match(timezone) || ['']).pop().replace(timezoneClip, '')";
			case 'o'   : return (utc) ? "'+0000'"
			                          : "(function(){ let o=v.getTimezoneOffset(); "
			                            + "return (o>0?'-':'+') + pad4(floor(abs(o)/60)*100 + abs(o)%60); })()";
			case 'S'   : return "(function(){ let d=v."+pref+"Date(); return ['th', 'st', 'nd', 'rd'][ (d%10 > 3) ? 0 : (d%100-d%10 !== 10)*d%10 ]; })()";
		}
		return "''";
	}
	
	let tokens = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZWN]|"[^"]*"|'[^']*'/g;
	
	let utc = ( f.slice(0, 4) === 'UTC:' );
	if( utc ) {
		f = f.slice( 4 );
	}
	
	let last_idx = 0, r, str, fns_done = {}, i18n_inc = false, Z_inc = false
	  , fn_head = "", fn_body = [], fn;
	
	fn_head += "  'use strict';\n";
	fn_head += "  function pad2(v){ return (v>=10) ? v : '0'+v; } \n";
	fn_head += "  function pad3(v){ return (v>=100) ? v : (v>=10) ? '0'+v : '00'+v; } \n";
	fn_head += "  function pad4(v){ return (v>=1000) ? v : (v>=100) ? '0'+v : (v>=10) ? '00'+v : '000'+v; } \n";
	fn_head += "  var floor = Math.floor, abs = Math.abs;\n";
	
	fn_head += "  \n";
	fn_head += "  // tokens\n";
	while( r = tokens.exec(f) ) {
		// copy clear text before token
		if( last_idx < r.index ) {
			str = f.substring( last_idx, r.index );
			str = escapeQuotes( str );
			fn_body.push( "'" + str + "'" );
		}
		last_idx = r.index + r[0].length;
		
		str = r[0];
		if( !i18n_inc && (str==='mmm' || str==='mmmm' || str==='ddd' || str==='dddd') ) {
			fn_head += "  var i18n = " + JSON.stringify(i18n) + ";\n";
			i18n_inc = true;
		}
		if( str==='Z' && !Z_inc ) {
			fn_head += "  var timezone = /\\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\\d{4})?)\\b/g;\n";
			fn_head += "  var timezoneClip = /[^-+\\dA-Z]/g;\n";
			Z_inc = true;
		}
		if( ! fns_done[str] ) {
			fns_done[str] = true;
			fn_head += "  var v_"+str+" = " + getToken(str, utc) +";\n";
		}
		fn_body.push( "v_" + str );
	}
	if( last_idx < f.length ) {
		str = f.substring( last_idx, f.length );
		str = escapeQuotes( str );
		fn_body.push( "'" + str + "'" );
	}
	fn_body = "  return " + fn_body.join("+") + ";\n";
	
	fn = fn_head + "\n  // make result \n" + fn_body;
	fn = new Function( "v", fn );
	cache[f] = fn;
	return fn;
}

module.exports = function formatDate( v, args ) {
	// accepted args:
	//  * f ({String} format)
	
	if( ! args['f'] ) {
		return '';
	}
	
	if( ! cache[args['f']] ) {
		compileDateFormat( args['f'] );
	}
	return cache[args['f']]( v );
};
