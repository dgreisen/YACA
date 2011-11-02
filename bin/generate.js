#!/usr/bin/env node

request = require('request');
querystring = require('querystring')
fs = require('fs')
url = require('url')
async = require('async')
cli = require('cli')
path = require('path')

path_rx = /{{path}}/g
database_rx = /{{db}}/g
ddoc_rx = /{{ddoc}}/g
handler_rx = /{{handler}}/g
method_rx = /{{method}}/g

database_code = "\n\
//** DB: {{db}} **\n\
couchdb['{{db}}'] = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}'].get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}'].del = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'del', callback)\n\
}\n\
couchdb['{{db}}'].post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}\n\
couchdb['{{db}}'].put = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'put', callback)\n\
}"

ddoc_code = "\n\
//** DB: {{db}} DDOC: {{ddoc}}**\n\
couchdb['{{db}}']['{{ddoc}}'] = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].del = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'del', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].put = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'put', callback)\n\
}"

handler_code = "\n\
couchdb['{{db}}']['{{ddoc}}'].{{handler}} = {}"

ddoc_api = 
  { views: { path: '_view/'
           , code: "\n\
couchdb['{{db}}']['{{ddoc}}'].views.{{method}} = function(query, callback) {\n\
  return couchdb._request_generator({query:query}, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].views.{{method}}.get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].views.{{method}}.post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', post, callback)\n\
}"
           }
  , shows: { path: '_show/'
           , code: "\n\
couchdb['{{db}}']['{{ddoc}}'].shows.{{method}} = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].shows.{{method}}.get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].shows.{{method}}.post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}"
           }
  , lists: { path: '_list/'
           , code: "\n\
couchdb['{{db}}']['{{ddoc}}'].lists.{{method}} = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].lists.{{method}}.get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].lists.{{method}}.post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}"
           }
  , updates: { path: '_update/'
             , code: "\n\
couchdb['{{db}}']['{{ddoc}}'].updates.{{method}} = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'put', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].updates.{{method}}.put = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'put', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].updates.{{method}}.post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}"
             }
  , rewrites: { path: '_rewrite/'
              , code: "\n\
couchdb['{{db}}']['{{ddoc}}'].rewrites.{{method}} = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].rewrites.{{method}}.get = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', null, callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].rewrites.{{method}}.put = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'put', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].rewrites.{{method}}.post = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'post', callback)\n\
}\n\
couchdb['{{db}}']['{{ddoc}}'].rewrites.{{method}}.del = function(options, callback) {\n\
  return couchdb._request_generator(options, '{{path}}', 'del', callback)\n\
}"
           }
  }


function gen_interface(uri, filename, admin) {
  host  = uri || 'http://127.0.0.1:5984/'
  host += (host.slice(-1) == '/') ? '' : '/' // ensure ends in slash
  uri = url.parse(host)
  filename = filename || path.join(__dirname, '/../lib/couchdb.js')

  // the results of parsing our db
  parsed_db = {_path:''};
  
  console.log('using host:', host)
  console.log('writing to file:', filename)
  if (admin) {
    console.log('making admin credentials available:', admin)
  }
  else {
    console.log('warning: no admin credentials provided (provide as third argument: "username:password")')
  }

    var source = fs.readFileSync(path.join(__dirname,'/../lib/template.js'), 'utf8');

  function write_line(line) {
    source += line + '\n'
  }

  
  // generate and append root uris
  var ROOT = '"'
  ROOT += uri.protocol || 'http:'
  ROOT += '//'
  ROOT += uri.hostname
  ROOT += (uri.port) ? ':'+uri.port : ''
  ROOT += '/"' 

  write_line('couchdb.ROOT = ' + ROOT)
  
  if (admin) {
    var ADMIN_ROOT ='"'
    ADMIN_ROOT  += uri.protocol || 'http:'
    ADMIN_ROOT += '//'
    ADMIN_ROOT += admin+'@'
    ADMIN_ROOT += uri.hostname
    ADMIN_ROOT += (uri.port) ? ':'+uri.port : ''
    ADMIN_ROOT += '/"'  
    write_line('couchdb.ADMIN_ROOT = ' + ADMIN_ROOT)
  }
  
  return request(host+'_all_dbs', handle_dbs);

  function handle_dbs(error, response, body) {
    body = JSON.parse(body);
    return async.forEach(body, parse_db, handle_db_complete)
  }
  
  function parse_db(db, db_callback) {
    // generate database api
    db_name = db
    if (['get', 'post', 'put', 'del', '_has_error', '_request_generator'].indexOf(db) >= 0) {
      db_name = '__'+db
      console.log(db, 'is a protected word. remapped to:', db_name)
    }
 
    db_path = db + '/';
    write_line(database_code.replace(database_rx, db_name).replace(path_rx, db_path))    
 
    // get the design docs for this db
    query = querystring.stringify({startkey:'"_design/"',endkey:'"_design0"',include_docs:true})
    return request(host+db+'/_all_docs?'+query, handle_ddocs)
    
    function handle_ddocs(error, response, body) {
      db_name = response.request.path.split('/')[1]
      db_name = (['get', 'post', 'put', 'del', '_has_error', '_request_generator'].indexOf(db) >= 0) ? '__'+db_name : db_name
      body = JSON.parse(body);
      for (i in body.rows) {
        // generate ddoc api
        ddoc = body.rows[i].doc
        ddoc_name = ddoc._id.split('/')[1];
        if (['get', 'post', 'put', 'del', '_path'].indexOf(ddoc_name) >= 0) {
          console.log(ddoc_name, 'is a protected word. remapped to:', '__'+ddoc_name)
          ddoc_name = '__'+ddoc_name;
        }

        ddoc_path = db_path + ddoc._id + '/'
        write_line(ddoc_code.replace(ddoc_rx, ddoc_name).replace(database_rx, db_name).replace(path_rx, ddoc_path))
        
        // generate handler (eg views, updates) apis contained in ddoc
        for (handler_name in ddoc) {
          if (handler_name in ddoc_api && JSON.stringify(ddoc[handler_name]) != JSON.stringify({})) {
            handler = ddoc[handler_name]
            handler_path = ddoc_path + ddoc_api[handler_name].path;
            write_line(handler_code.replace(handler_rx, handler_name)
                                   .replace(ddoc_rx, ddoc_name)
                                   .replace(database_rx, db_name)
                                   .replace(path_rx, handler_path) )
            
            // put any method calls (eg _view/_by_id) in target handler
            for (method_name in handler) {
              method_path = handler_path + method_name
              write_line(ddoc_api[handler_name].code
                                               .replace(method_rx, method_name)
                                               .replace(ddoc_rx, ddoc_name)
                                               .replace(database_rx, db_name)
                                               .replace(path_rx, method_path) )
            }
          }
        }
      }
      return db_callback();
    }
  }
  
  function handle_db_complete(error) {
    fs.writeFileSync(filename, source)
    console.log('Done')
  }
}



cli.parse( { 'file': ['f', 'filename for output code', 'path', path.join(__dirname,'../lib/couchdb.js')]
           , 'admin': ['a', 'admin basic auth in the form of: username:password', 'string']
           , 'db': ['d', 'db root url, include basic-auth admin privileges if needed to modify db.', 'url', 'http://127.0.0.1:5984']
           } )
           
cli.main(function(args, options) {
  gen_interface(options.db, options.file, options.admin);    
  })
//if (!module.parent) {
//console.log(process)
//  gen_interface(process.argv[2], process.argv[3], process.argv[4])
//}

