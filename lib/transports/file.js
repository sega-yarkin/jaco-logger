/**
 * @fileOverview
 * File transport.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 * 
 */

'use strict';

let fs            = require( 'fs' );
let util          = require( 'util' );
let cluster       = require( 'cluster' );
let JacoTransport = require( '../transport.js' );
let EOL           = require( 'os' ).EOL;

let streams = {};


util.inherits( JacoTransportFile, JacoTransport );
function JacoTransportFile( jaco, root, route, old_route ) {
	let e = JacoTransport.call( this, jaco, root, route );
	if( e instanceof Error )
		return e;
	this.opts = {
		'file_name' : route.file_name,
		'mode'      : parseInt( route.mode, 8 ),
		'stream'    : route.stream,
		'separate'  : route.separate,
		'reset_file': route.reset_file,
		'master_ext': route.master_ext,
		'worker_ext': route.worker_ext,
		'rotate'    : route.rotate
	};
	this.fname = undefined;
	if( ! this.opts.mode ) {
		this.opts.mode = parseInt( "0644", 8 );
	}
	this.dst = undefined;
	this.prepareStream();
}
JacoTransportFile.prototype.name = "file";

JacoTransportFile.prototype.prepareStream = function prepareStream( callback ) {
	let jaco  = this.parent;
	let o     = this.opts;
	
	this.fname = o.file_name;
	if( o.separate ) {
		this.fname += (cluster.isMaster) ? o.master_ext : o.worker_ext;
	}
	let vars = [ jaco.variables ];
	this.fname = jaco.Formats.applyString( this.fname, jaco.formatters, vars, jaco.getVar );
	
	if( o.stream ) {
		if( ! streams[this.fname] ) {
			let file_opts = {
				'flags': (o.separate && o.reset_file) ? 'w' : 'a',
				'mode' : o.mode,
			};
			streams[this.fname] = {
				// stream object
				's': fs.createWriteStream( this.fname, file_opts ),
				// listeners counter
				'l': 0
			};
		}
		streams[this.fname].l++;
		this.dst = streams[this.fname];
	}
	else {
		this.dst = this.fname;
	}
};

JacoTransportFile.prototype.out = function out( vars, callback ) {
	let jaco   = this.parent;
	let format = this.format || jaco.format;
	let o      = this.opts;
	let str = jaco.formats[ format ]( vars, jaco.formatters, jaco.getVar ) + EOL;
	if( ! this.dst ) {
		// TODO: need for queue?
		callback();
	}
	else if( typeof(this.dst) === 'string' ) {
		let file_opts = {
			'flags': 'a',
			'mode' : o.mode,
		};
		fs.appendFile( this.dst, str, file_opts, callback );
	}
	else {
		this.dst.s.write( str, callback );
	}
};

JacoTransportFile.prototype.free = function free() {
	if( typeof(this.dst) === 'object' ) {
		this.dst.l--;
		// close stream if no listeners
		if( this.dst.l < 1 ) {
			this.dst.s && this.dst.s.end();
			delete streams[ this.fname ];
		}
	}
};


module.exports = JacoTransportFile;
