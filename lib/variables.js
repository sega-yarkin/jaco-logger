/**
 * @fileOverview
 * Initialize variables.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @license     MIT
 *
 */

'use strict';


let os      = require( 'os' );
let cluster = require( 'cluster' );


module.exports = function initializeVariables( jaco, config ) {
	var vars = {};
	
	function cacheIt( fn, seconds ) {
		let cachedFn = function() {
			let d = Date.now();
			if( (d-cachedFn.atime) >= seconds*1000 ) {
				cachedFn.atime = d;
				cachedFn.val   = fn();
			}
			return cachedFn.val;
		};
		cachedFn.atime = 0;
		cachedFn.val   = undefined;
		return cachedFn;
	}
	
	//
	// System
	//
	vars['date'] = function(){ return new Date; };
	vars['role'] = jaco.roles[ jaco.role ];
	vars['wid' ] = cluster.isMaster ? 0 : cluster.worker.id;
	vars['role-ident'] = cluster.isMaster ? vars['role']
	                   : vars['role']+"#"
	                     +( vars['wid']>=100 ? vars['wid'] : ('00'+vars['wid']).slice(-3) );
	
	//
	// OS properties
	//
	vars['os.tmpdir']         = os.tmpdir();
	vars['os.hostname']       = os.hostname();
	vars['os.short-hostname'] = vars['os.hostname'].split('.')[0];
	vars['os.type']           = os.type();
	vars['os.platform']       = os.platform();
	vars['os.arch']           = os.arch();
	vars['os.release']        = os.release();
	vars['os.uptime']         = os.uptime;
	vars['os.totalmem']       = cacheIt( os.totalmem, 60 );
	vars['os.freemem']        = os.freemem;
	vars['os.cpus-count']     = function(){ return cacheIt(os.cpus, 60).length; };
	
	let os_loadavg = cacheIt( os.loadavg, 10 );
	vars['os.loadavg'] = function( mins ){
		let ret = 0.0;
		if( mins === '1' )
			ret = os_loadavg()[0];
		else if( mins === '5'  )
			ret = os_loadavg()[1];
		else if( mins === '15' )
			ret = os_loadavg()[2];
		return ret;
	};
	
	//
	// Process properties
	//
	vars['proc.cwd']        = process.cwd;
	vars['proc.env']        = function( name ){ return process.env[name]; };
	vars['proc.uid']        = process.getuid || '';
	vars['proc.gid']        = process.getgid || '';
	vars['proc.pid']        = process.pid;
	vars['proc.uptime']     = function(){
		let diff = Date.now() - jaco._ms_init;
		return diff/1000;
	};
	vars['proc.uptime-hr']  = function(){
		let diff = process.hrtime( jaco._hr_init );
		return diff[0] + (diff[1]/1e9);
	};
	
	vars['proc.ver.node']   = process.versions.node;
	vars['proc.ver.v8'  ]   = process.versions.v8;
	vars['proc.ver.uv'  ]   = process.versions.uv;
	vars['proc.ver.zlib']   = process.versions.zlib;
	vars['proc.ver.ssl' ]   = process.versions.openssl;
	
	let proc_memoryUsage = cacheIt( process.memoryUsage, 10 );
	vars['proc.mem.rss']    = function(){ return proc_memoryUsage()['rss']; };
	vars['proc.mem.heap']   = function(){ return proc_memoryUsage()['heapUsed']; };
	
	
	return vars;
};
