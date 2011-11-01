Request = require('request')
querystring = require('querystring')

var couchdb = function(options, callback) {
  return couchdb._request_generator(options, '', null, callback)
}

couchdb.get = function(options, callback) {
  return couchdb._request_generator(options, '', null, callback)
}

couchdb.del = function(options, callback) {
  return couchdb._request_generator(options, '', 'del', callback)
}

couchdb.post = function(options, callback) {
  return couchdb._request_generator(options, '', 'post', callback)
}

couchdb.put = function(options, callback) {
  return couchdb._request_generator(options, '', 'put', callback)
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

couchdb._request_generator = function(options, path, method, callback) {
  console.log('generating request', options, path, method)
  // convert options to a standardized form.                                                         
  options = (typeof(options) == 'string') ? {'uri':options}: options;
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
  options.uri = uri;
  // append query, if any
  if (options.query && JSON.stringify(options.query) != JSON.stringify({})) {
    for (key in options.query) {
      options.query[key] = (typeof(options.query[key]) == 'string') ? options.query[key] 
                                                                    : JSON.stringify(options.query[key])
    }
    uri += '?' + querystring.stringify(options.query);
  }

  var request = (!method) ? Request : Request[method];
  console.log(options)
  return request(options, handle_response);

  // return any couchdb errors as errors. handle body parsing unless specifically declined (options.parse=false)
  function handle_response(error, response, body) {
    error = couchdb._has_error(error, response, body);
    if (error) {
        return (callback(error, response, body));
    }

      if (options.parse) {
      try {body = JSON.parse(body)}
      catch(err) {return callback({'error':'json parse error','malformed JSON':body})}
    }
    return callback(error, response, body);
  }
}

module.exports = couchdb;
