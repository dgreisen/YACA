# YACA #
## Custom-generated CouchDB api through database introspection ##

Simply import YACA, and call the factory function. The factory function introspects your CouchDB instance and returns a custom api. This allows you to make intuitive and easy calls to your database, and inspect your database from the commandline. For example, to request all documents from the 'master' view of the '_design/app' design document of your 'primary_db' database you simply make the following call:

    api_factory = require('YACA');
    api_factory(function(error, couchdb_api) {
      couchdb_api.primary_db.app.views.master(function(error, response, body) {
        console.log(body)
      })
    })

It is that simple.

## General Design ##
YACA was designed for CouchDB databases where the number of databases and the design documents remain relatively stable. As such, the structure of the database is cached, and the api is generated from this cached structure unless `update: true` is explicitly passed to the factory. In a future release, YACA will be able to introspect DB changes at will; however, currently, you must create a new couchdb_api instance with the api_factory every time the database is added/removed, or a design document is modified. 

YACA is based on Mikeal's [request](https://github.com/mikeal/request/) module. Therefore, with a few exceptions listed below, api commands accept an options 
argument and a callback. They return an error, the original response, and the parsed JSON body. Because it is based on request, you can do fancy things like piping, etc. made possible by Mikeal's module. See <https://github.com/mikeal/request> for more info.

## Installation ##
    git clone git://github.com/dgreisen/YACA.git 
    cd YACA
    npm link

## Usage ##
### 1. Generate API ###
First, generate the API by calling:

    api_factory = require('YACA');
    api_factory(factory_options, callback)

 * `factory_options` - an optional hash. See [factory options](#factory_options) reference for more.
 * `callback` - a callback function of the form `callback(error, couchdb_api)`.

You can optionally call `generate_couche_api` from the commandline:

    generate_couch_api [-f PATH] [-d DB_URL] [-a USERNAME:PASSWORD]

 * `PATH` - the location of the file into which to write the couchdb api. If not specified, it will be placed in path/to/YACA/lib/couchdb.js, and will be imported when you `require('YACA')`.
 * `DB_URL` - the url to your CouchDB instance. It defaults to `http://127.0.0.1:5984`. If privileges are needed to view design documents or the root instance, provide username and password as: `http://username:password@host_name`
 * `USERNAME:PASSWORD` - basic auth credentials where `USERNAME` is an admin username and `PASSWORD` is the admin's password, if you wish to be able to access admin-restricted content through the api. *The username and password will be stored in the generated cache.* See [options reference](#options) for more.

The command line function is useful for generating a cache that your production code can then access and create an api without ever having to introspect the database.

### 2. Use the API ###
There are four primary API methods, corresponding to the http methods:
 * `get`
 * `put`
 * `post`
 * `del`

To make a call against a database:

    couchdb.{{database_name}}.{{http_method}}(options, callback)

or against a particular handler:

    couchdb.{{database_name}}
           .{{design_doc_name}}
            .{{handler_name}}
           .{{method}}
           .{{http_method}}(options, callback)

See [options](#options) for what is allowed in options. callback is of the form: `callback(error, response, body)` where `response` is the unadulterated response from the CouchDB server and `body` is a javascript object parsed from the JSON response body.

There are some [helper functions](#helpers) described below that have slightly different usage patterns.

### 4. Example ###
Assume we have a CouchDB instance with the following structure:

 * CouchDB
   * primarydb
     * _design/app
     * _design/global
     * doc1
   * secondarydb
     * _design/app
     * doca

We use the api thus:

    couchdb_factory = require('YACA');
    
    couchdb_factory( { db_url:'127.0.0.1:5984'
                     , admin :'administrator:password'
                     , update:true
                     }
                   , handle_api
                   )

    function handle_api(error, couchdb) {
      callback = function(error, response, body) {console.log(error, body)}

      // create new document
      couchdb.primarydb.put({uri:'doc2',json:{field1:'hello'}}, callback)

      // view existing document
      couchdb.primarydb.get('doc1', callback);
    
      // edit existing document
      couchdb.primarydb.put( { uri:'doc2'
                             , json:{ field1:'goodbye'
                                    , _rev:'34_434c5f645'
                                    }
                             }
                           , callback
                           )

      // view all docs from a view
      couchdb.secondarydb.app.views.by_date.get(callback)
    }

Hopefully this gives you a general idea of how the API works.

## API ##

### Errors ###
When couchdb returns any code greater than 299, the api returns a javascript option parsed from the CouchDB error response with the added field 'statusCode,' with the http StatusCode.

<a name='factory_options' />
### Factory Options ###
The couchdb_factory, takes an optional options hash. If no hash is given, the defaults will be used. The defaults usually work just fine. However it is important to use `update` when the database structure has changed.
 * `db_url` - the url to your CouchDB instance. It defaults to `http://127.0.0.1:5984`. If privileges are needed to view design documents or the root instance, provide username and password as: `http(s)://username:password@host_name`
 * `admin` - basic auth string, `USERNAME:PASSWORD`, where `USERNAME` is an admin username and `PASSWORD` is the admin password, if you wish to be able to access admin-restricted content through the api. *The username and password will be stored in plain text in the cache.* See [options] reference(#options) for more.
 * `file` is the location of the cached database configuration. YACA caches thedatabase structure so it does not have to introspect the database every time it generates an api. If set to `false`, no cache will be created. If not specified, the cache will be placed in path/to/YACA/lib/couchdb.js.
 * `update` controls introspection. If `update: true`, then the database will be introspected when an api is created even if a cache exists.

You must create a new API whenever you add or remove a database, or you modify a design document. 


<a name='options' /> 
### Options ###
YACA is derived from request, and so it supports most of the options supported by request, and a few more

Options can be either a string representing the command you wish to execute, or it can be an options object.

The valid keys in the options object are:
* `uri` || `url` - The CouchDB command you wish to execute. the API will prepend the appropriate url for the root/database/design doc/handler method from which you are making the request.
* `body` - entity body for POST and PUT requests. Must be buffer or string.
* `json` - sets `body` but to JSON representation of value and adds `Content-type: application/json` header.
* `parse` - defaults to `true`, returned `body` will be a javascript object parsed from the JSON body.
* `admin` - provide basic auth admin credentials in the request to the database. Only provided if admin credentials were provided to couchdb_factory.
* `query` - hash object of query parameters. api uses JSON.stringify on any non-string hash values. Then uses querystring.stringify on the entire hash.
* `auth` - *not yet supported.* provide the given basic auth credentials. value must be a string: `username:password`.
* `onResponse` - *not yet supported.*



### Standard API ###
All of the following API calls conform are passed an options argument and a callback. The callback is then called with three arguments: an error, the CouchDB http response, and a javascript object parsed from the CouchDB response

#### CouchDB Root ####
* couchdb(options, callback) - shortcut for .get
* couchdb.get(options, callback)
* couchdb.post(options, callback)
* couchdb.put(options, callback)
* couchdb.del(options, callback)

#### Database ####
* couchdb.{{db}}(options, callback) - shortcut for .get
* couchdb.{{db}}.get(options, callback)
* couchdb.{{db}}.post(options, callback)
* couchdb.{{db}}.put(options, callback)
* couchdb.{{db}}.del(options, callback)

Where {{db}} is the name of the database. if your database name is a protected word, the YACA database_fatory will notify you, and {{db}} will be your database name prepended with '__' (two underscores).

#### Design Documents ####
* couchdb.{{db}}.{{ddoc}}(options, callback) - shortcut for .get
* couchdb.{{db}}.{{ddoc}}.get(options, callback)
* couchdb.{{db}}.{{ddoc}}.post(options, callback)
* couchdb.{{db}}.{{ddoc}}.put(options, callback)
* couchdb.{{db}}.{{ddoc}}.del(options, callback)

Where {{db}} is as described above, and {{ddoc}} is the _id of your design doc stripped of the '_design/'.

#### Views ####
* couchdb.{{db}}.{{ddoc}}.views.{{method}}.get(options, callback)
* couchdb.{{db}}.{{ddoc}}.views.{{method}}.post(options, callback)

#### Shows ####
* couchdb.{{db}}.{{ddoc}}.shows.{{method}}(options, callback) - shortcut for .get
* couchdb.{{db}}.{{ddoc}}.shows.{{method}}.get(options, callback)
* couchdb.{{db}}.{{ddoc}}.shows.{{method}}.post(options, callback)

#### Lists ####
* couchdb.{{db}}.{{ddoc}}.lists.{{method}}.get(options, callback) - shortcut for .get
* couchdb.{{db}}.{{ddoc}}.lists.{{method}}.post(options, callback)

#### Updates ####
* couchdb.{{db}}.{{ddoc}}.updates.{{method}}(options, callback) - shortcut for .put
* couchdb.{{db}}.{{ddoc}}.updates.{{method}}.put(options, callback)
* couchdb.{{db}}.{{ddoc}}.updates.{{method}}.post(options, callback)

#### Rewrites ####
* couchdb.{{db}}.{{ddoc}}.rewrites.{{method}}(options, callback) - shortcut for .get
* couchdb.{{db}}.{{ddoc}}.rewrites.{{method}}.get(options, callback)
* couchdb.{{db}}.{{ddoc}}.rewrites.{{method}}.pust(options, callback)
* couchdb.{{db}}.{{ddoc}}.rewrites.{{method}}.post(options, callback)
* couchdb.{{db}}.{{ddoc}}.rewrites.{{method}}.del(options, callback)

<a name='helpers' />
### Helper API ###
Anything you can do with the helper APIs you can do with the standard API. For example, you could get uuids in either of the two following ways:

    couchdb._uuids(3, callback(e, b) {console.log(b)})
    // response: [{{uuid1}}, {{uuid2}}, {{uuid3}}]

    couchdb.get( {uri:'_uuid',query:{count:'3'}}
               , callback(e, r, b) {console.log(b)})
    // response: {uuids: [{{uuid1}}, {{uuid2}}, {{uuid3}}]}

As you can see, the helper functions simply reduce the verbosity. But if you are already familiar with the couchdb apis, it might simply be easier to use the standard API, rather than having to refer to the helper api.

#### CouchDB Root ####
* couchdb._uuids([count], callback(error, uuids))
  * `count` - number of uuids to return - defaults to 1
  * `uuids` - array of uuid strings returned by CouchDB

#### Updates ####
* couchdb.{{db}}.{{ddoc}}.updates.{{method}}(json, callback)
  * `json` - body to send to the update
  * returns standard (error, response, body) to the callback

### Views ###
* couchdb.{{db}}.{{ddoc}}.views.{{method}}(query, callback)
  * `query` - query parameters to pass to the view
  * returns standard (error, response, body) to the callback

  

