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

database_code = "\ncouchdb['{{db}}'] = db_factory('{{path}}')"

ddoc_code = "\ncouchdb['{{db}}']['{{ddoc}}'] = db_factory('{{path}}')"

handler_code = "\ncouchdb['{{db}}']['{{ddoc}}'].{{handler}} = {}"

method_code = "\n\
couchdb['{{db}}']['{{ddoc}}'].{{handler}}['{{method}}'] = method_factories['{{handler}}']('{{path}}')"

handlers = {views:'_view/',shows:'_show/',lists:'_list/',updates:'_update/',rewrites:'_rewrite/'};

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
    console.log('warning: no admin credentials provided')
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
      db_name = response.request.path.split('/')[1];
      db_path = db_name + '/';
      db_name = (['get', 'post', 'put', 'del', '_has_error', '_request_generator'].indexOf(db) >= 0) ? '__'+db_name : db_name;
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
          if (handler_name in handlers && JSON.stringify(ddoc[handler_name]) != JSON.stringify({})) {
            handler = ddoc[handler_name]
            handler_path = ddoc_path + handlers[handler_name];
            write_line(handler_code.replace(handler_rx, handler_name)
                                   .replace(ddoc_rx, ddoc_name)
                                   .replace(database_rx, db_name) )
            
            // put any method calls (eg _view/_by_id) in target handler
            for (method_name in handler) {
              method_path = handler_path + method_name + '/'
              write_line(method_code.replace(method_rx, method_name)
                                    .replace(ddoc_rx, ddoc_name)
                                    .replace(handler_rx, handler_name)
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


