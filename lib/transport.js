/**
 * @fileOverview
 * Transport prototype.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 * 
 */

'use strict';


function JacoTransport( jaco, route ) {
	this.parent     = jaco;
	this.route      = route.name || "";
	this.level      = -1;
	this.policy     = undefined;
	this.include    = undefined;
	this.includeA   = undefined;
	this.exclude    = undefined;
	this.excludeA   = undefined;
	this.format     = undefined;
	this.lang       = undefined;
	this.events     = {};
	
	if( route.level !== undefined ) {
		this.level = jaco.levels.indexOf( route.level );
		if( ! ~this.level )
			return new SyntaxError("Unknown level name '"+route.level+"'");
	}
	if( route.policy !== undefined ) {
		this.policy = jaco.policies.indexOf( route.policy );
		if( ! ~this.policy )
			return new SyntaxError("Unknown policy name '"+route.policy+"'");
	}
	if( route.include !== undefined ) {
		this.include = jaco.generateInExArray( route.include );
		if( this.include instanceof Error ) {
			this.include.message = "Error in option 'include': " + this.include.message;
			return this.include;
		}
	}
	if( route['include+'] !== undefined ) {
		this.includeA = jaco.generateInExArray( route['include+'] );
		if( this.includeA instanceof Error ) {
			this.includeA.message = "Error in option 'include+': " + this.includeA.message;
			return this.includeA;
		}
	}
	if( route.exclude !== undefined ) {
		this.exclude = jaco.generateInExArray( route.exclude );
		if( this.exclude instanceof Error ) {
			this.exclude.message = "Error in option 'exclude': " + this.exclude.message;
			return this.exclude;
		}
	}
	if( route['exclude+'] !== undefined ) {
		this.excludeA = jaco.generateInExArray( route['exclude+'] );
		if( this.excludeA instanceof Error ) {
			this.excludeA.message = "Error in option 'exclude+': " + this.excludeA.message;
			return this.excludeA;
		}
	}
	if( route.lang !== undefined ) {
		this.lang = jaco.resolveLanguage( route.lang );
		if( ! this.lang ) {
			return new SyntaxError("Cannot find language '"+route.lang+"'");
		}
	}
	if( route.events !== undefined ) {
		if( ! (route.events instanceof Object) ) {
			return new SyntaxError("Option 'events' should be an object");
		}
		let eventNames = Object.keys( route.events );
		for( let i=0, len=eventNames.length, hdls, e; i<len; i++ ) {
			hdls = route.events[ eventNames[i] ];
			if( typeof(hdls) === 'string' ) {
				hdls = [ hdls ];
			}
			if( ! Array.isArray(hdls) ) {
				return new SyntaxError(
					"Option 'events."+eventNames[i]+"' should be an array or string"
				);
			}
			if( hdls.length < 1 )
				continue;
			e = this.events[ eventNames[i] ] = [];
			for( let j=0, len2=hdls.length; j<len2; j++ ) {
				if( ! jaco.formats[hdls[j]] ) {
					return new SyntaxError("Cannot find format '"+hdls[j]+"'");
				}
				e.push( hdls[j] );
			}
		}
	}
	if( route.format !== undefined ) {
		if( ! jaco.formats[route.format] ) {
			return new SyntaxError("Cannot find format '"+route.format+"'");
		}
		this.format = route.format;
	}
	
}
JacoTransport.prototype.name = "";

JacoTransport.prototype.out = function out( vars, callback ) {
	throw new Error( "function should be overwrited" );
};


module.exports = JacoTransport;
