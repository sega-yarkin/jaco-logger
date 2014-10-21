/**
 * @fileOverview
 * Format strings routines.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 */

'use strict';


function json_format( vars, fns, getVar ) {
	return JSON.stringify( getVar(vars, 'msg') );
}

function defaultFormats( formats ) {
	formats[ 'text' ] = "${date|format(f=yyyy-mm-dd HH:MM:ss.l)} | [${level|align(s=right,w=5)}] ${msg}";
	formats[ 'json' ] = json_format;
	//formats[ 'start-message' ] = "Hello!";
}

function compileFormats( formats, formatters ) {
	let names = Object.keys( formats );
	for( let i=0, len=names.length, n; i<len; i++ ) {
		formats[ names[i] ] = compileFormat( formats[names[i]], formatters );
	}
}

function compileFormat( format, formatters ) {
	//
	// FORMAT-STRING = "RAW-CHUNK $\{VARIABLE-CHUNK\} RAW-CHUNK"
	//
	//   VARIABLE-CHUNK = VAR-PIPE-CHUNK [ | FORMAT-PIPE-CHUNK ]*
	//
	//     VAR-PIPE-CHUNK    = VAR-NAME ( [, VAR-PARAM]* )
	//     FORMAT-PIPE-CHUNK = FORMAT-FUNC ( [, FUNC-PARAM-NAME = FUNC-PARAM-VALUE]* )
	//
	function escapeQuotes( str ) {
		return str.replace( '\'', '\\\'' )
		          .replace( '\"', '\\\"' );
	}
	function unescapeReserved( str ) {
		return str.replace( '\\$\\{', '${' )
		          .replace( '\\{', '{' )
		          .replace( '\\,', ',' );
	}

	// Check for function
	if( typeof(format) === 'function' ) {
		return format;
	}
	// Check for non-string
	if( typeof(format) !== 'string' ) {
		return function(){ return ""; };
	}
	// If string not contains variables
	if( ! ~format.indexOf("${") ) {
		format = escapeQuotes( format );
		format = unescapeReserved( format );
		return new Function( "return '"+format+"';" );
	}

	let re1 = /\$\{(\\\}|[^}])+\}/g;
	let re2 = /^([^\(]+)(\(([^\)]+)\))?$/;
	let re3 = /(\\,|[^,])+/g;
	let re4 = /^[a-z0-9_\-.@]+$/i;
	
	let chunks = [], last_idx = 0, r, str, pipe
	  , chunk, i, j, len, fn, args, arg;
	//
	// Parse format string to chunks
	//
	while( r = re1.exec(format) ) {
		// copy clear string before variable
		if( last_idx < r.index ) {
			str = format.substring( last_idx, r.index );
			str = escapeQuotes( str );
			str = unescapeReserved( str );
			chunks.push( str );
		}
		last_idx = r.index + r[0].length;
		
		str = r[0].substring( 2, r[0].length-1 ).trim();
		pipe = str.split('|');
		chunk = [];
		for( i=0, len=pipe.length; i<len; i++ ) {
			args = pipe[i].match( re2 );
			if( ! args )
				break;
			//     var/fn name    args
			fn = [ args[1].trim(), {} ];
			if( args[3] ) {
				args = args[3].trim().match( re3 );
				for( j=0; j<args.length; j++ ) {
					arg = args[j].split('=');
					if( arg.length < 2 )
						fn[1][j] = arg[0].trim().replace("\\,", ",");
					else
						fn[1][ arg[0].trim() ] = arg[1].trim().replace("\\,", ",");
				}
				if( formatters[fn[0]] && formatters[fn[0]].prepareArgs ) {
					fn[1] = formatters[fn[0]].prepareArgs( fn[1] );
				}
			}
			chunk.push( fn );
		}
		chunks.push( chunk );
	}
	if( last_idx < format.length ) {
		str = format.substring( last_idx, format.length );
		str = escapeQuotes( str );
		str = unescapeReserved( str );
		chunks.push( str );
	}
	
	//
	// Make a function
	//
	fn = "  var res='', v, f;\n";
	for( i=0, len=chunks.length; i<len; i++ ) {
		chunk = chunks[i];
		if( typeof(chunk) === 'string' ) {
			fn += "  // #" + (i+1) + "\n";
			fn += "  res += '"+chunk+"';\n";
		}
		else if( Array.isArray(chunk) ) {
			args = Object.keys( chunk[0][1] );
			if( args.length > 0 ) {
				for( j=0; j<args.length; j++ ) {
					args[j] = chunk[0][1][ args[j] ];
				}
				str = " '" + args.join( "', '" ) + "' ";
			}
			else {
				str = '';
			}
			fn += "  // #" + (i+1) + ", variable \n";
			fn += "  v = '"+chunk[0][0]+"';\n";
			fn += "  v = getVar( vars, v );\n";
			fn += "  if( v instanceof Function ) {\n";
			fn += "    v = v("+str+");\n";
			fn += "  }\n";
			if( chunk.length > 1 ) {
				fn += "  // #" + (i+1)+ ", " + chunk[1][0] + "\n";
				fn += "  while( v!==undefined ) {\n";
				for( j=1; j<chunk.length; j++ ) {
					if( ! Array.isArray(chunk[j]) ) {
						continue;
					}
					fn += "    f = '"+chunk[j][0]+"';\n";
					fn += "    if( fns[f]===undefined ) {\n";
					fn += "      v = ''; break;\n";
					fn += "    }\n";
					str = JSON.stringify( chunk[j][1] );
					fn += "    v = fns[f]( v, "+str+" );\n"
				}
				fn += "    break;\n";
				fn += "  }\n";
			}
			fn += "  res += (v!==undefined) ? v : '';\n"
		}
	}
	fn += "  return res;\n";
	
	fn = new Function( "vars", "fns", "getVar", fn );
	return fn;
}

function applyString( str, formatters, vars, getVar ) {
	let fn = compileFormat( str, formatters );
	return fn( vars, formatters, getVar );
}

module.exports = {
	'defaultFormats': defaultFormats,
	'compileFormats': compileFormats,
	'compileFormat' : compileFormat,
	'applyString'   : applyString
};
