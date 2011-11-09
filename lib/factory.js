// Derived from code kindly provided by Raynos (https://github.com/Raynos)
var Request = require('request');
var querystring = require('querystring');

Object.extend = function(dest, source) {
    Object.getOwnPropertyNames(source).forEach(function (key) {
        dest[key] = source[key];
    });  
};

// this factory function takes a hash of methods and attributes for a 
// prototype object and creates a new factory for creating objects of 
// that type. if the call method is in the hash, it will be bound to the
// object itself, making the object a callable function.
var proto_factory_factory = function (proto_hash) {
    var proto = Object.create(Function.prototype);
    Object.extend(proto, proto_hash);
    return function () {
      var f = function () {
        return proto.call.apply(f, arguments);      
      };
      Object.keys(proto).forEach(function (key) {
        if (key != 'call' && key !='constructor') {
          f[key] = proto[key];
        }
      });
      // set the callback and replace the passed callback with the internal 
      // callback;
      var callback_index = ''+arguments.length-1;
      var callback = arguments[callback_index];
      arguments[callback_index] = handle_constructor_complete;
      proto.constructor.apply(f, arguments);

      function handle_constructor_complete(error) {
        if (error) return callback(error);
        return callback(null, f);
      }
    }
}

var proto_factory_factory_sync = function (proto_hash) {
  var proto = Object.create(Function.prototype);
  Object.extend(proto, proto_hash);
  return function () {
    var f = function () {
        return proto.call.apply(f, arguments);      
    };
    Object.keys(proto).forEach(function (key) {
        if (key != 'call' && key !='constructor') {
          f[key] = proto[key];
        }
    });
    proto.constructor.apply(f, arguments);
    return f;
  }
}

function init_helper(names) {
  names.forEach(function(i) {that[i] = methods[i]});
}

// given a list of method names ['get','post','del','put'] generate an object 
// with those methods, plus a constructor. If an optional call string with a 
// method name is given, add a call method of that type.
function proto_helper(names, call) {
  var proto = {};
  methods =
    { get: function(options, callback) {
        return this._request(options, null, callback)
      }
    , del: function(options, callback) {
        return this._request(options, 'del', callback)
      }
    , put: function(options, callback) {
        return this._request(options, 'put', callback)
      }
    , post: function(options, callback) {
        return this._request(options, 'post', callback)
      }
    }

  names.forEach(function(i) {proto[i] = methods[i]});
  if (call) {proto.call = methods[call];}
  proto.constructor = constructor_helper;
  return proto;
}

/*
cache =
{ ADMIN_PATH: 
, PATH:

*/
function constructor_helper(cache) {
  var ADMIN_PATH = cache.ADMIN_PATH;
  var PATH = cache.PATH;
  // private. has_error returns the error/couchdb error, if it exists or null.
  var _has_error = function(error, response, body) {
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

  this._request = function(options, method, callback) {
//    console.log('generating request', options, PATH, method)
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
    uri  = (options.admin && ADMIN_PATH) ? ADMIN_PATH : PATH;
    uri += (options.uri == '/') ? '' : options.uri; // don't want a double slash
  // append query, if any
    if (options.query && JSON.stringify(options.query) != '{}') {
      for (key in options.query) {
        if (typeof(options.query[key]) != 'string') {
          options.query[key] = JSON.stringify(options.query[key])
        }
      }
      uri += '?' + querystring.stringify(options.query);
      delete options.query;
    }
    options.uri = uri;

    var request = (!method) ? Request : Request[method];
//    console.log('request options:', options)
    return request(options, handle_response);

    // return any couchdb errors as errors. handle body parsing unless specifically declined (options.parse=false)
    function handle_response(error, response, body) {
      error = _has_error(error, response, body);
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

}

function child_constructor(cache, child_factory) {
  for (child_name in cache.children) {
    var child_cache = cache.children[child_name];
    this[child_name] = child_factory(child_cache);
  }
}

exports.factory = proto_factory_factory
exports.factory_sync = proto_factory_factory_sync
exports.proto_helper = proto_helper
exports.constructor_helper = constructor_helper
exports.child_constructor = child_constructor