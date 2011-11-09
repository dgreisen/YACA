var Request = require('request');
var querystring = require('querystring');
var factory = require('./factory');
var factory_factory = factory.factory;
var factory_factory_sync = factory.factory_sync;
var proto_helper = factory.proto_helper;
var constructor_helper = factory.constructor_helper;
var child_constructor = factory.child_constructor;
var fs = require('fs')
var url = require('url')
var async = require('async')
var db_factory = require('./db_factory');
var path = require('path')

handlers = {views:'_view',shows:'_show',lists:'_list',updates:'_update',rewrites:'_rewrite'};

// ** CouchDB Root **
var proto_couchdb = proto_helper(['get', 'put', 'post', 'del'], 'get');

proto_couchdb['_uuids'] = function(count, callback) {
  if(!callback) {
    callback = count;
    options = '_uuids';
  }
  else {
    options = {uri:'_uuids', query:{count:count}};
  }
  return this.get(options, helper);

  function helper(e,r,b) {
    if (e) {return callback(e);}
    return callback(null, b['uuids']);
  }
}

// options: 
// file: name of cache file false if no cache - defaults to ./api_cache.json
// db_url: url of couchdb - defaults to http://127.0.0.1:5984
// update: update cache on init - defaults to false
// admin: admin credentials
proto_couchdb.constructor = function(options, callback){
  if (!callback) {
    callback = options;
    options = {};
  }

  var that = this;
  options = options || {};
  var cache = {}

  if (options.file !== false) {
    options.file = options.file || path.join(__dirname, '/api_cache.json')
    return fs.readFile(options.file, 'utf8', handle_file);
  }
  else {
    return handle_file('no cache');
  }

  function handle_file(error, file) {
    // if error, then no file, so set up defaults
    // otherwise, use cache.
    if (error) {
      // set defaults
      options.db_url = options.db_url || 'http://127.0.0.1:5984/';
      generate_cache(options);
    }
    else {
      // parse file and update with new options, if any;
      cache = JSON.parse(file);
      constructor_helper.apply(that, [cache]);
      var changed = false;
      if (options.update) {
        changed = true;
        delete options.update;
      }
      for (key in options) {
        if (cache[key] != options[key]) {
          cache[key] = options[key];
          changed = true;
        }
      }
      if (cache.update || changed) {
        return generate_cache(cache);
      }
      else {
        return generate_api(cache);
      }
    }
  }

  function generate_cache(options) {
    // ensure url ends in slash
    options.db_url += (options.db_url.slice(-1) == '/') ? '' : '/'; 
    var uri = url.parse(options.db_url);

    cache = options;
    cache.children = {};

    // generate and append root uris
    cache.PATH  = uri.protocol || 'http:'
    cache.PATH += '//'
    cache.PATH += uri.hostname
    cache.PATH += (uri.port) ? ':'+uri.port : ''
    cache.PATH += '/' 

    if (options.admin) {
      cache.ADMIN_PATH  = uri.protocol || 'http:'
      cache.ADMIN_PATH += '//'
      cache.ADMIN_PATH += options.admin+'@'
      cache.ADMIN_PATH += uri.hostname
      cache.ADMIN_PATH += (uri.port) ? ':'+uri.port : ''
      cache.ADMIN_PATH += '/'  
    }
    else {console.log('warning: no admin privileges provided.');}

    // add helper functions
    constructor_helper.apply(that, [cache]);
    that.get('_all_dbs', handle_dbs);

    function handle_dbs(error, response, body) {
      if (error) return callback(error);
      return async.forEach(body, parse_db, write_cache)
    }

    // called on each database; adds db structure and path info to cache
    function parse_db(db, db_callback) {
      // insert paths
      db_name = db
      if (['get', 'post', 'put', 'del'].indexOf(db_name) >= 0) {
        db_name = '__'+db_name
        console.log(db, 'is a protected word. remapped to:', db_name)
      }
      cache.children[db_name] = {children:{}};
      var db_cache = cache.children[db_name];
      add_paths(db_cache, cache, db);

      // get the design docs for this db
      query = {startkey:'"_design/"',endkey:'"_design0"',include_docs:true}
      return that.get({uri:db+'/_all_docs',query:query}, handle_ddocs)
    
      function handle_ddocs(error, response, body) {
        db_name = response.request.path.split('/')[1];
        if (['get', 'post', 'put', 'del'].indexOf(db_name) >= 0) {
          db_name = '__'+db_name
        }
        db_cache = cache.children[db_name];

        for (i in body.rows) {
          // insert paths
          ddoc = body.rows[i].doc
          ddoc_name = ddoc._id.split('/')[1];
          if (['get', 'post', 'put', 'del', '_path'].indexOf(ddoc_name) >= 0) {
            console.log( ddoc_name
                       , 'is a protected word. remapped to:'
                       , '__'+ddoc_name
                       )
            ddoc_name = '__'+ddoc_name;
          }
          db_cache.children[ddoc_name] = {children:{}};
          ddoc_cache = db_cache.children[ddoc_name];        
          add_paths(ddoc_cache, db_cache, ddoc._id);
        
          // handler (eg views, updates) paths
          for (handler_name in ddoc) {
            if (  handler_name in handlers 
               && JSON.stringify(ddoc[handler_name]) != JSON.stringify({})
               ) {
              handler = ddoc[handler_name]
              ddoc_cache.children[handler_name] = {children:{}};
              handler_cache = ddoc_cache.children[handler_name];
              add_paths(handler_cache, ddoc_cache, handlers[handler_name]);
              
              // put any method calls (eg _view/by_id) in target handler
              for (method_name in handler) {
                handler_cache.children[method_name] = {};
                method_cache = handler_cache.children[method_name];
                add_paths(method_cache, handler_cache, method_name);
              }
            }
          }
        }
        return db_callback();
      }
    }
  
    // called when all dbs are parsed. writes cache to disk.
    function write_cache() {
      if (cache.file) {
        fs.writeFile(cache.file, JSON.stringify(cache), handle_write);
      }

      function handle_write(error) {
        if (error) {
          console.log( 'WARNING: unable to write cache to location:'
                     , cache.file
                     );
        }
        return generate_api();
      }
    }

    // helper function - given a cache, parent_cache and path, append path
    // to parent_cache paths and place in cache path.
    function add_paths(cache, parent_cache, path) {
      cache.PATH = parent_cache.PATH + path + '/';
      if (parent_cache.ADMIN_PATH) {
        cache.ADMIN_PATH = parent_cache.ADMIN_PATH + path + '/';
      }
    }
  }

  function generate_api() {
    child_constructor.apply(that, [cache, db_factory, that]);
    return callback();
  }

      
}



var couchdb_factory = factory_factory(proto_couchdb)


// synchronous version of couchdb_factory
// file: name of cache file false if no cache - defaults to ./api_cache.json

var proto_couchdb_sync = proto_couchdb;
proto_couchdb_sync.constructor = function(file) {
  file = file || path.join(__dirname, '/api_cache.json')

  var cache =  JSON.parse(fs.readFileSync(file, 'utf8'));
  constructor_helper.apply(this, [cache]);
  child_constructor.apply(this, [cache, db_factory, this]);
}

var couchdb_factory_sync = factory_factory_sync(proto_couchdb_sync)
exports.api_factory = couchdb_factory;
exports.api_factory_sync = couchdb_factory_sync;
