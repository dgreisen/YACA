#!/usr/bin/env node

couchdb_factory = require('YACA').api_factory;
cli = require('cli');
path = require('path');

cli.parse( { 'file' : [ 'f'
                      , 'filename for output code'
                      , 'path'
                      , path.join(__dirname,'../lib/api_cache.json')
                      ]
           , 'admin': [ 'a'
                      , 'admin basic auth in the form of: username:password'
                      , 'string'
                      ]
           , 'db'   : [ 'd'
                      , 'db root url, include basic-auth admin privileges if needed to view db.'
                      , 'url'
                      , 'http://127.0.0.1:5984'
                      ]
           } )

cli.main(function(args, options) {
  couchdb_factory( {file:options.file, admin:options.admin, db_url:options.db}
                 , function(error, couchdb) {
                     if (error) {console.log(error)}
                     else {console.log('complete')}
		   }
                 );
})
