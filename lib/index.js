/**
 * @fileOverview
 * Configurable logging tools.
 *
 * @author      Sergey I. Yarkin <sega.yarkin@gmail.com>
 * @version     0.1.0
 * @license     MIT
 *
 */

'use strict';


let fs      = require( 'fs' );
let util    = require( 'util' );
let cluster = require( 'cluster' );
let EOL     = require( 'os' ).EOL;

let noop   = function noop(){};
let slice  = Array.prototype.slice;
let extend = util._extend;
let l = console.log.bind( console );

const DEFAULT_LEVELS   = [ 'debug', 'info', 'warn', 'error', 'crit' ];
const DEFAULT_ROLES    = [ 'master', 'worker' ];
const DEFAULT_POLICIES = [ 'everything', 'nothing' ];

const TRANSPORT_PATH = "./transports";

let Formats = require( './formats' );

let _instances = {};

/**
 * Jaco Logger.
 *
 * @public
 * @constructor
 * @this {Jaco}
 */
function Jaco( config ) {
	// Check instance in cache
	if( typeof(config) === 'string' ) {
		return _instances[ config ];
	}

	this.config     = undefined;
	this.config_ver = undefined;

	this.role       = undefined;
	this.role_req   = undefined;
	this.level      = undefined;
	this.policy     = undefined;
	this.lang       = "default";
	this.format     = "text";
	this.include    = [];
	this.exclude    = [];
	this.modules    = false;
	this.events     = {};
	
	this.levels     = undefined;
	this.roles      = undefined;
	this.policies   = undefined;

	this.transports = {};
	this.routes     = {};
	this.route_names= [];
	this.channels   = [];
	this.formats    = {};
	this.messages   = {};
	this.variables  = {};
	this.formatters = {};
	this.tags       = {};
	
	this.Channel    = undefined;
	
	if( !config || config instanceof Error ) {
		config = {};
	}
	
	// get from cache
	let inst;
	if( typeof(config.name)==='string' && _instances[config.name] ) {
		inst = _instances[ config.name ];
	}
	else {
		inst = this;
	}
	
	let r = inst.loadConfig( config );
	if( r instanceof Error )
		return r;
	return inst;
};

Object.defineProperties( Jaco.prototype, {
	'POLICY_EVERY': { value: 0, writable: false },
	'POLICY_NO'   : { value: 1, writable: false },
	
	'ROLE_MASTER' : { value: 0, writable: false },
	'ROLE_WORKER' : { value: 1, writable: false },
	
	'TAG_LEVEL'   : { value:-1, writable: false }
});

Jaco.prototype._ms_init = Date.now();
Jaco.prototype._hr_init = process.hrtime();

Jaco.prototype.Formats = Formats;

Jaco.loadConfigFromFile = function loadConfigFromFile( filename, callback ) {
	// Load file async
	if( typeof(callback) === 'function' ) {
		fs.readFile( filename, function readFileDone( err, data ) {
			if( err ) {
				callback( err );
				return;
			}
			try {
				data = JSON.parse( data );
			}
			catch( err ) {
				callback( err );
				return;
			}
			callback( undefined, data );
		});
	}
	// Load file sync
	else {
		let data;
		// Load from file
		try {
			data = fs.readFileSync( filename );
		}
		catch( err ) {
			return err;
		}
		// Parse JSON
		try {
			data = JSON.parse( data );
		}
		catch( err ) {
			return err;
		}
		return data;
	}
};


function initParameters( jaco, config ) {
	//
	// Cache instance if name is set.
	//
	if( typeof(config.name) === 'string' ) {
		_instances[ config.name ] = jaco;
	}
	//
	// Init modules option
	//
	if( config.modules !== undefined ) {
		if( typeof(config.modules) !== 'boolean' ) {
			return new SyntaxError("Option 'module' should be a boolean");
		}
		jaco.modules = ( config.modules === true );
	}
	//
	// Init channel class
	//
	if( jaco.modules ) {
		jaco.Channel = function Channel( module, shown_as ) {
			JacoChannel.call( this, jaco, module, shown_as );
		};
		util.inherits( jaco.Channel, JacoChannel );
	}

	//
	// Init levels.
	// Create constants like LVL_<LEVEL_NAME> in channel class.
	// Create short functions for every level in channel class.
	//
	jaco.levels = DEFAULT_LEVELS;
	if( Array.isArray(config.levels) ) {
		jaco.levels = config.levels;
	}
	for( let i=0, len=jaco.levels.length, lvl, lvl_prop; i<len; i++ ) {
		lvl      = jaco.levels[i].toLowerCase();
		lvl_prop = 'LVL_' + lvl.toUpperCase();
		
		if( jaco.modules ) {
			if( jaco.Channel.prototype[lvl_prop] !== undefined ) {
				return new TypeError("Level '"+jaco.levels[i]+"' is duplicate");
			}
			Object.defineProperty( jaco.Channel.prototype, lvl_prop, {
				value   : i,
				writable: false
			});
			(function(lvl, name){
				jaco.Channel.prototype[ name ] = function levelWrap( message, opts ) {
					return this.log( lvl, message, opts );
				};
			})( i, lvl );
		}
		else {
			if( jaco[lvl_prop] !== undefined ) {
				return new TypeError("Level '"+jaco.levels[i]+"' is duplicate");
			}
			Object.defineProperty( jaco, lvl_prop, {
				value   : i,
				writable: false
			});
			(function(lvl, name){
				jaco[ name ] = function levelWrap( message, opts ) {
					return this.log( lvl, message, opts );
				};
			})( i, lvl );
		}
	}
	//
	// Init cluster role names.
	//
	jaco.roles = DEFAULT_ROLES;
	if( Array.isArray(config.roles) && config.roles.length>=2 ) {
		jaco.roles = config.roles.slice( 0, 2 );
	}
	//
	// Init policy names.
	//
	jaco.policies = DEFAULT_POLICIES;
	if( Array.isArray(config.policies) && config.policies.length>=2 ) {
		jaco.policies = config.policies.slice( 0, 2 );
	}
	//
	// Init messages.
	//
	jaco.messages = { 'default': {} };
	if( config.messages instanceof Object ) {
		if( ! resolveLanguage(config) ) {
			return new TypeError("Messages should contans 'default' language");
		}
		jaco.messages = config.messages;
	}
	//
	// Init others parameters.
	//
	jaco.role = cluster.isMaster ? 0 : 1;
	
	//
	// Init variables.
	//
	jaco.variables = require('./variables')( jaco, config );
	if( ! jaco.variables ) {
		jaco.variables = {};
	}
	//
	// Init formatters.
	//
	jaco.formatters = require( './formatters' );
	
	return true;
}

function loadTransports( jaco, config ) {
	let i=0, r=config.routes, t, len;
	if( ! Array.isArray(r) ) {
		return true;
	}
	len = r.length;
	for( ; i<len; i++ ) {
		t = r[i].transport;
		if( ! t ) {
			return new SyntaxError("Cannot find transport value in route "+i);
		}
		if( ! jaco.transports[t] ) {
			try {
				jaco.transports[t] = require( TRANSPORT_PATH + "/" + t );
			}
			catch( err ) {
				console.error( err );
				if( err.code === 'MODULE_NOT_FOUND' ) {
					return new SyntaxError("Cannot find transport '"+t+"'");
				}
				else {
					return new SyntaxError("Cannot load transport '"+t+"'");
				}
			}
		}
	}
	return true;
}

function generateInExArray( jaco, src ) {
	let res = [], ret, i, j, props, p, len, len2;
	function pushRe( re_str, level ) {
		let re;
		if( level === undefined ) {
			level = -1;
		}
		else if( typeof(level) !== 'string' ) {
			return new TypeError("Bad level name '" + level + "'");
		}
		else {
			let l = jaco.levels.indexOf( level );
			if( ! ~l ) {
				return new TypeError("Bad level name '" + level + "'");
			}
			level = l;
		}
		if( !~re_str.indexOf('*') && !~re_str.indexOf('?') ) {
			re = re_str;
		}
		else {
			re_str = re_str.replace('.', '\\.')
			               .replace('*', '.*')
			               .replace('?', '.');
			re = new RegExp( '^'+re_str+'$', 'i' );
		}
		res.push([ re, level ]);
	}
	
	for( i=0, len=src.length; i<len; i++ ) {
		if( typeof(src[i]) === 'string' ) {
			ret = pushRe( src[i] );
			if( ret instanceof Error ) {
				return ret;
			}
		}
		else if( src[i] instanceof Object ) {
			props = Object.keys( src[i] );
			for( j=0, len2=props.length, p; j<len2; j++ ) {
				p = props[j];
				ret = pushRe( p, src[i][p] );
				if( ret instanceof Error ) {
					return ret;
				}
			}
		}
		else {
			return new TypeError("Bad array item type #"+i);
		}
	}
	return res;
}

function findInArray( arr, mod ) {
	let res = false;
	if( !Array.isArray(arr) || arr.length<1 ) {
		return res;
	}
	for( let i=0, len=arr.length; i<len; i++ ) {
		if( ! Array.isArray(arr[i]) )
			continue;
		if( typeof(arr[i][0])==='string' && arr[i][0]===mod ) {
			res = arr[i][1];
		}
		else if( arr[i][0] instanceof RegExp ) {
			if( mod.match(arr[i][0]) ) {
				res = arr[i][1];
			}
		}
	}
	return res;
}

function flushRoutes( routes ) {
	let rts = Object.keys( routes ), r;
	for( let i=0, len=rts.length; i<len; i++ ) {
		r = routes[ rts[i] ];
		if( r && typeof(r.free)==='function' ) r.free();
	}
}

function createRoutes( jaco, config ) {
	
	let root = {
		'role_req':-1,
		'level'   :-1,
		'policy'  : 0,
		'lang'    : "default",
		'formats' : {},
		'format'  : "text",
		'include' : [],
		'exclude' : [],
		'events'  : {},
		'routes'  : {},
		'tags'    : {}
	};
	
	//
	// Check and fill root parameters
	//
	if( config.role !== undefined ) {
		if( typeof(config.role)!=='string' || (config.role!=='any' && !~jaco.roles.indexOf(config.role)) ) {
			return new SyntaxError("Unknown role name '"+config.role+"'");
		}
		root['role_req'] = jaco.roles.indexOf( config.role );
	}
	if( config.level !== undefined ) {
		if( typeof(config.level)!=='string' || !~jaco.levels.indexOf(config.level) ) {
			return new SyntaxError("Unknown level name '"+config.level+"'");
		}
		root['level'] = jaco.levels.indexOf( config.level );
	}
	if( config.policy !== undefined && jaco.modules ) {
		if( typeof(config.policy)!=='string' || !~jaco.policies.indexOf(config.policy) ) {
			return new SyntaxError("Unknown policy name '"+config.policy+"'");
		}
		root['policy'] = jaco.policies.indexOf( config.policy );
	}
	if( config.lang !== undefined ) {
		if( typeof(config.lang) !== 'string' ) {
			return new SyntaxError("Option 'lang' should be a string");
		}
		root['lang'] = resolveLanguage( jaco, config.lang );
		if( ! root['lang'] ) {
			return new SyntaxError("Cannot find language '"+config.lang+"'");
		}
	}
	Formats.defaultFormats( root['formats'] );
	if( config.formats instanceof Object ) {
		let names = Object.keys(config.formats), n;
		for( let i=0, len=names.length; i<len; i++ ) {
			n = names[i];
			root['formats'][ n.trim() ] = config.formats[ n ];
		}
	}
	Formats.compileFormats( root['formats'], jaco.formatters );
	if( config.format !== undefined ) {
		if( typeof(config.format) !== 'string' ) {
			return new SyntaxError("Option 'format' should be a string");
		}
		if( ! root['formats'][config.format] ) {
			return new SyntaxError("Cannot find format '"+config.format+"'");
		}
		root['format'] = config.format;
	}
	if( config.include !== undefined && jaco.modules ) {
		if( ! Array.isArray(config.include) ) {
			return new SyntaxError("Option 'include' should be an array");
		}
		root['include'] = generateInExArray( jaco, config.include );
		if( root['include'] instanceof Error ) {
			root['include'].message = "Error in option 'include': " + root['include'].message;
			return root['include'];
		}
	}
	if( config.exclude !== undefined && jaco.modules ) {
		if( ! Array.isArray(config.exclude) ) {
			return new SyntaxError("Option 'exclude' should be an array");
		}
		root['exclude'] = generateInExArray( jaco, config.exclude );
		if( root['exclude'] instanceof Error ) {
			root['exclude'].message = "Error in option 'exclude': " + root['exclude'].message;
			return root['exclude'];
		}
	}
	if( config.events !== undefined ) {
		if( ! (config.events instanceof Object) ) {
			return new SyntaxError("Option 'events' should be an object");
		}
		let eventNames = Object.keys( config.events );
		for( let i=0, len=eventNames.length, hdls, e; i<len; i++ ) {
			hdls = config.events[ eventNames[i] ];
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
			e = root['events'][ eventNames[i] ] = [];
			for( let j=0, len2=hdls.length; j<len2; j++ ) {
				if( ! root['formats'][hdls[j]] ) {
					return new SyntaxError("Cannot find format '"+hdls[j]+"'");
				}
				e.push( hdls[j] );
			}
		}
	}
	else if( root['formats']["start-message"] ) {
		root['events'] = {
			'start': ["start-message"]
		};
	}
	
	//
	// Make routes
	//
	if( config.routes === undefined ) {
		// default route
		config.routes = [{
			'name'     : "default-route",
			'transport': "console",
			'level'    : "info"
		}];
	}
	else if( !Array.isArray(config.routes) || config.routes.length<1 ) {
		return new TypeError("Option 'routes' should be a non-empty array");
	}
	
	function freeOnError( err ) {
		flushRoutes( root.routes );
		return err;
	}
	
	let r = loadTransports( jaco, config );
	if( r instanceof Error ) {
		return r;
	}
	
	for( let i=0, len=config.routes.length, r, t, n, ex; i<len; i++ ) {
		r = config.routes[i];
		if( ! jaco.transports[r.transport] ) {
			return freeOnError( new TypeError("Cannot find transport '"+r.transport+"'") );
		}
		n = r.name;
		if( typeof(n) !== 'string' ) {
			if( len === 1 ) {
				n = r.name = "default-route";
			}
			else {
				return freeOnError( new TypeError("Cannot find route name for #"+i) );
			}
		}
		t = new jaco.transports[r.transport]( jaco, root, r, jaco.routes[n] );
		if( t instanceof Error ) {
			t.message = "Could not create a route '"+n+"': " + t.message;
			return freeOnError( t );
		}
		root.routes[n] = t;
		if( r.tags ) {
			if( Array.isArray(r.tags) ) {
				for( let j=0, len2=r.tags.length; j<len2; j++ ) {
					if( ! root.tags[r.tags[j]] ) {
						root.tags[r.tags[j]] = [ n ];
					}
					else {
						root.tags[r.tags[j]].push( n );
					}
				}
			}
		}
	}
	
	return root;
}

function resolveLanguage( jaco, lang ) {
	lang = (!lang) ? "default" : lang.trim();
	let hist = [];
	while( ! ~hist.indexOf(lang) ) {
		hist.push( lang );
		// if ''symlink''
		if( typeof(jaco.messages[lang]) === 'string' ) {
			lang = jaco.messages[lang];
			continue;
		}
		if( typeof(jaco.messages[lang]) !== 'object' ) {
			return false;
		}
		return lang;
	}
	return false;
}


Jaco.prototype.getVar = function getVar( vars_list, name ) {
	for( let i=vars_list.length-1; i>=0; i-- ) {
		if( vars_list[i][name] !== undefined ) {
			return vars_list[i][ name ];
		}
	}
	return undefined;
};

Jaco.prototype.loadConfig = function loadConfig( config ) {
	let self = this;
	
	if( typeof(config) !== 'object' ) {
		return new TypeError("'config' must be an object");
	}

	function reconfig() {
		let root = createRoutes( self, config );
		if( root instanceof Error )
			return root;
		
		let old_routes =  self.routes;
		
		// copy parameters value
		self.role_req = root.role_req;
		self.level    = root.level;
		self.policy   = root.policy;
		self.lang     = root.lang;
		self.format   = root.format;
		self.formats  = root.formats;
		self.include  = root.include;
		self.exclude  = root.exclude;
		self.events   = root.events;
		self.routes   = root.routes;
		self.tags     = root.tags;
		
		self.route_names = Object.keys( self.routes );
		flushRoutes( old_routes );
		self.config_ver++;
		self.config = config;
		
		// recalc channel's levels
		for( let i=0, len=self.channels.length; i<len; i++ ) {
			self.channels[i].recalcLevels();
		}
		
		return true;
	}
	

	// If we loading config first time
	if( self.config_ver === undefined ) {
		let r = initParameters( self, config );
		if( r instanceof Error )
			return r;
		self.config_ver = 0;
	}
	return reconfig();
};

Jaco.prototype.flushRoutes = function() {
	flushRoutes( this.routes );
};

Jaco.prototype.generateInExArray = function( src ) {
	return generateInExArray( this, src );
};

Jaco.prototype.resolveLanguage = function( lang ) {
	return resolveLanguage( this, lang );
};

Jaco.prototype.log = function log( level, message, opts, channel ) {
	opts = opts || {};
	let callback = opts.callback || function(){};
	//
	// Check and parse input parameters
	if( typeof(level) === 'number' ) {
		if( level===this.TAG_LEVEL && opts._tag && opts._routes ) { /* ok */ }
		else if( level<0 || level>=this.levels.length ) {
			callback( new TypeError("level not found") );
			return;
		}
	}
	else if( typeof(level) === 'string' ) {
		level = this.levels.indexOf( level );
		if( ! ~level ) {
			callback( new TypeError("level not found") );
			return;
		}
	}
	else {
		callback( new TypeError("level should be a number or string") );
		return;
	}
	
	if( !message && message!=="" ) {
		callback( new TypeError("message should be a string or object") );
		return;
	}
	else if( typeof(message) === 'object' ) {
		if( Array.isArray(message) && typeof(message[0])==='string' ) {
			message = util.format.apply( util, message );
		}
		else if( message instanceof Error ) {
			let stack = message.stack;
			if( typeof(stack) === 'string' ) {
				stack = stack.replace(/ {3,}/g,'').split('\n');
				stack.shift(); 
				stack = '\t\t' + stack.join( EOL+'\t\t' ); 
			}
			message = '<Error object>: ' + message.message + '\n' + stack;
		}
		else {
			message = util.inspect( message );
		}
	}

	//
	// Prepare
	let vars = [ this.variables ];
	let local_vars = {
		'level' : this.levels[ level ],
		'level#': level,
		'tag'   : opts._tag,
		'msg'   : message
	};
	
	if( this.modules ) {
		if( ! channel ) {
			throw new Error( "Channel is required if modules enabled" );
		}
		vars.push( channel.vars );
		if( ! opts._routes ) {
			opts._routes = [];
			let rt = channel.rt_levels, len=rt.length;
			for( let i=0; i<len; i++ ) {
				if( level >= rt[i].level )
					opts._routes.push( rt[i].name );
			}
		}
	}
	else {
		if( ! opts._routes ) {
			let gl = this.level
			  , max_lvl, max_name;
			let rt_names = this.route_names
			  , len = rt_names.length, rt;
			
			for( let i=0; i<len; i++ ) {
				rt = this.routes[ rt_names[i] ];
				if( rt.level < gl )
					continue;
				if( !max_lvl || (rt.level>max_lvl) ) {
					max_lvl  = rt.level;
					max_name = rt.route;
				}
			}
			if( ! max_lvl ) {
				callback();
				return;
			}
			opts._routes = [ max_name ];
		}
	}
	
	// compose vars list
	if( opts.vars ) {
		if( Array.isArray(opts.vars) ) {
			for( let i=0, len=opts.vars.length; i<len; i++ )
				vars.push( opts.vars[i] );
		}
		else {
			vars.push( opts.vars );
		}
	}
	vars.push( local_vars );
	
	if( !opts._routes || !opts._routes.length ) {
		callback();
		return;
	}
	
	if( opts._routes.length === 1 ) {
		this.routes[ opts._routes[0] ].out( vars, callback );
	}
	else {
		let len = opts._routes.length
		  , cnt = len;
		
		function onDone() {
			cnt--;
			if( ! cnt ) {
				callback();
			}
		}
		
		for( let i=0; i<len; i++ ) {
			this.routes[ opts._routes[i] ].out( vars, onDone );
		}
	}
	
};

Jaco.prototype.tag = function tag( tags, message, opts, channel ) {
	opts = opts || {};
	if( Array.isArray(tags) ) {
		let res;
		for( let i=0, len=tags.length; i<len; i++ ) {
			if( this.tags[tags[i]] ) {
				let _opts = extend( {}, opts );
				_opts._tag    = tags[i];
				_opts._routes = this.tags[ tags[i] ];
				res = this.log( this.TAG_LEVEL, message, _opts, channel );
				if( res instanceof Error )
					return res;
			}
		}
	}
	else if( this.tags[tags] ) {
		opts._tag    = tags;
		opts._routes = this.tags[tags];
		return this.log( this.TAG_LEVEL, message, opts, channel );
	}
};


//
// Jaco channel class.
//

function JacoChannel( jaco, module, shown_as ) {
	if( ! jaco.modules ) {
		throw new Error( "Modules isn't enabled, use .log function of Jaco object instead" );
	}
	this.parent = jaco;
	if( ! shown_as ) {
		shown_as = module;
	}
	this.module    = module;
	this.shown_as  = shown_as;
	this.rt_levels = [];
	
	this.vars = {
		'module': this.module
	};
	
	this.recalcLevels();
	this.parent.channels.push( this );
};

JacoChannel.prototype.recalcLevels = function recalcLevels() {
	this.rt_levels = [];
	let logg = this.parent;
	//
	if( logg.role_req!==-1 && logg.role_req!==logg.role ) {
		return;
	}
	//
	let mod = this.module;
	let glob_inc_lvl = findInArray( logg.include, mod )
	  , glob_exc_lvl = findInArray( logg.exclude, mod )
	  , glob_policy  = logg.policy;
	let lvl, rt, inc_lvl, exc_lvl, policy;
	
	//l([ glob_inc_lvl, glob_exc_lvl, glob_policy ]);
	
	let route_names = Object.keys( logg.routes );
	for( let i=0, len=route_names.length; i<len; i++ ) {
		rt = logg.routes[ route_names[i] ];
		//
		// include
		inc_lvl = glob_inc_lvl;
		if( rt.include ) {
			inc_lvl = findInArray( rt.include, mod );
		}
		else if( rt.includeA ) {
			lvl = findInArray( rt.includeA, mod );
			if( lvl!==false && (inc_lvl===false || lvl < inc_lvl) ) {
				inc_lvl = lvl;
			}
		}
		//
		// exclude
		exc_lvl = glob_exc_lvl;
		if( rt.exclude ) {
			exc_lvl = findInArray( rt.exclude, mod );
		}
		else if( rt.excludeA ) {
			lvl = findInArray( rt.excludeA, mod );
			if( lvl!==false && (exc_lvl===false || lvl > exc_lvl) ) {
				exc_lvl = lvl;
			}
		}
		//
		// policy
		policy = rt.policy || glob_policy;
		
		//l([ inc_lvl, exc_lvl, policy ]);
		//l([ rt.level, logg.level ]);
		
		//
		// calc result level
		if( policy === Jaco.prototype.POLICY_EVERY ) {
			// all -> exclude -> include
			lvl = ( rt.level >= 0 )
			    ? rt.level
			    : (logg.level+1 || 1)-1;
			if( exc_lvl !== false ) {
				lvl = (exc_lvl>=0) ? exc_lvl+1 : -1;
			}
			if( inc_lvl !== false ) {
				lvl = ( inc_lvl >= 0 )
				    ? Math.min( lvl, inc_lvl )
				    : 0;
			}
		}
		// policy === Jaco.prototype.POLICY_NO
		else {
			// empty -> include -> exclude
			lvl = -1;
			if( inc_lvl !== false ) {
				lvl = ( inc_lvl >0 )
				    ? inc_lvl
				    : ( (rt.level>=0)
				          ? rt.level
				          : (logg.level+1 || 1)-1 );
			}
			if( exc_lvl !== false && lvl !== -1 ) {
				lvl = ( exc_lvl >= 0 )
				    ? Math.max( lvl, exc_lvl )
				    : -1;
			}
		}
		//
		// push to route's levels list
		if( lvl >= 0 ) {
			this.rt_levels.push({
				'name' : route_names[i],
				'level': lvl
			});
		}
	}
};

JacoChannel.prototype.log = function log( level, message, opts ) {
	return this.parent.log( level, message, opts, this );
};

JacoChannel.prototype.tag = function tag( tags, message, opts ) {
	return this.parent.tag( tags, message, opts, this );
};

module.exports = Jaco;
