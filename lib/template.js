var Request = require('request');
var querystring = require('querystring');
var factory_factory = require('./factory_factory');

function proto_helper(names, call) {
  var proto = {};
  methods =
    { get: function(options, callback) {
        return couchdb._request(options, this._path, null, callback)
      }
    , del: function(options, callback) {
        return couchdb._request(options, this._path, 'del', callback)
      }
    , put: function(options, callback) {
        return couchdb._request(options, this._path, 'put', callback)
      }
    , post: function(options, callback) {
        return couchdb._request(options, this._path, 'post', callback)
      }
    }

  names.forEach(function(i) {proto[i] = methods[i]});
  if (call) {proto.call = methods[call];}
  proto.constructor = function(path) {this._path = path;}
  return proto;
}

// ** CouchDB root **
var proto_db = proto_helper(['get', 'put', 'post', 'del'], 'get');
var db_factory = factory_factory(proto_db)

// ** DDOC **
var proto_ddoc = proto_helper(['get', 'put', 'post', 'del'], 'get');
var ddoc_factory = factory_factory(proto_ddoc)

// ** Handlers **
var proto_view = proto_helper(['get', 'post']);
proto_view.call = function(query, callback) {
  if (!callback) return couchdb._request('', this._path, null, query)
  return couchdb._request({query:query}, this._path, null, callback)
}
var proto_show = proto_helper(['get', 'post'], 'get');
var proto_list = proto_helper(['get', 'post'], 'get');
var proto_update = proto_helper(['put', 'post'], 'put');
var proto_rewrite = proto_helper(['get', 'put', 'post', 'del'], 'get');

method_factories = 
  {    views: factory_factory(proto_view)
  ,    shows: factory_factory(proto_show)
  ,    lists: factory_factory(proto_list)
  ,  updates: factory_factory(proto_update)
  , rewrites: factory_factory(proto_rewrite)
  }


// ** CouchDB Root
var couchdb = function(options, callback) {
  return couchdb._request(options, '', null, callback)
}

couchdb.get = function(options, callback) {
  return couchdb._request(options, '', null, callback)
}

couchdb.del = function(options, callback) {
  return couchdb._request(options, '', 'del', callback)
}

couchdb.post = function(options, callback) {
  return couchdb._request(options, '', 'post', callback)
}

couchdb.put = function(options, callback) {
  return couchdb._request(options, '', 'put', callback)
}

couchdb._uuids = function(count, callback) {
  if(!callback) {
    callback = count;
    options = '';
  }
  else {
    options = {query:{count:count}};
  }
  return couchdb._request(options, '_uuids', null, helper);

  function helper(e,r,b) {
    if (e) {return callback(e);}
    return callback(null, b['uuids']);
  }
}

// private. has_error returns the error/couchdb error, if it exists or null.
couchdb._has_error = function(error, response, body) {
  // return connection error
  if (error) {
    return error
  }
  // return formatted couchdb error
  else if (response.statusCode > 299) {
    try {
      body = JSON.parse(body)
    }
    catch (err) {}
    body.statusCode = response.statusCode
    return body;
  }
  // return no error                                                                                 
  else {
    return null
  }
}

couchdb._request = function(options, path, method, callback) {
  console.log('generating request', options, path, method)
  // convert options to a standardized form.                                      
  // if someone just gives a callback, the callback will be in the options
  // variable, and callback will be empty. make call to db with empty path
  if (typeof(options) == 'function' && !callback) {
    callback = options;
    options = {'uri':''};
  }
  // normalize to hash
  else if (typeof(options) == 'string') {
    options = {'uri':options}
  }
  
  if ('url' in options) {
    options.uri = options.url
    delete options.url
  }
  
  // make sure there is a uri
  options.uri = (options.uri) ? options.uri : '';
  
  // default to parsing JSON response
  options.parse = (options.parse === false) ? false : true;
  
  // create the uri
  var uri;
  uri  = (options.admin && couchdb.ADMIN_ROOT) ? couchdb.ADMIN_ROOT : couchdb.ROOT;
  uri += path;
  uri += (options.uri == '/') ? '' : options.uri; // don't want a double slash
  // append query, if any
  if (options.query && JSON.stringify(options.query) != JSON.stringify({})) {
    for (key in options.query) {
      options.query[key] = (typeof(options.query[key]) == 'string') ? options.query[key] 
                                                                    : JSON.stringify(options.query[key])
    }
    uri += '?' + querystring.stringify(options.query);
    delete options.query;
  }
  options.uri = uri;

  var request = (!method) ? Request : Request[method];
  console.log('request options:', options)
  return request(options, handle_response);

  // return any couchdb errors as errors. handle body parsing unless specifically declined (options.parse=false)
  function handle_response(error, response, body) {
    error = couchdb._has_error(error, response, body);
    if (error) {
        return (callback(error, response, body));
    }

    if (options.parse && typeof(body) == 'string') {
      try {body = JSON.parse(body)}
      catch(err) {
        return callback({'error':'json parse error','malformed JSON':body})
      }
    }
    return callback(error, response, body);
  }
}

module.exports = couchdb;
