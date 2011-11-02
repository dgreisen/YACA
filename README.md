# YACA #
## Custom-generated CouchDB api through introspection ##

You do not use YACA directly. Instead, you run the script `generate_couch_api` which introspects your CouchDB instance and generates a custom api. You then import that custom API into your node project and make api calls on it. This allows you to make intuitive and easy calls to your DB. for example, to request all documents from the 'master' view of the '_design/app' design document of your 'primary' database you simply make the following call:

    couchdb = require('couchdb') // import our generated api
    couchdb.primary.app.views.master(callback)
    callback = function(error, response, body) {
      console.log(body)
    }

It is that simple.

## General Design ##
YACA was designed for CouchDB databases where the number of databases and the design documents remain relatively stable. In the future, YACA will be able to introspect DB changes at runtime; however, currently, you must run YACA every time a DB is added/removed, or a design document is modified. 

YACA is based on Mikeal's [request](https://github.com/mikeal/request/) module. Therefore, with a few exceptions listed below, api commands accept an options 
argument and a callback. They return an error, the original response, and the parsed JSON body. Because it is based on request, you can do fancy things like piping, etc. made possible by Mikeal's module. See <https://github.com/mikeal/request> for more info.

## Installation ##
    git clone git://github.com/dgreisen/YACA.git 
    cd YACA
    npm link

## Usage ##
### 1. Generate API ###
First, generate the API by calling:

    generate_couch_api [-f PATH] [-d DB_URL] [-a USERNAME:PASSWORD]

 * `PATH` is the location of the file into which to write the couchdb api. If not specified, it will be placed in path/to/YACA/lib/couchdb.js, and will be imported when you `require('YACA')`.
 * `DB_URL` is the url to your CouchDB instance. It defaults to `http://127.0.0.1:5984`. If privileges are needed to view design documents or the root instance, provide username and password as: `http://username:password@host_name`
 * provide `USERNAME:PASSWORD` where `USERNAME` is an admin username and `PASSWORD` is the admin's password, if you wish to be able to access admin-restricted content through the api. *The username and password will be stored in the generated API code.* See [options reference](#options) for more.

You must regenerate the API whenever you add or remove a database, or you modify a design document. 

### 2. Import the generated API ###
If you used the defaults to generate your custom API, then you can import that api by:

    couchdb = require("YACA");

If you specified a different `PATH`, simply import from that file. The rest of this document assumes you have imported the generated api into a variable called`couchdb`.

### 3. Use the API ###
There are four primary API methods, corresponding to the http methods:
 * `get`
 * `put`
 * `post`
 * `del`

To make a call against a database:

    couchdb.<<database_name>>.<<http_method>>(options, callback)

or against a particular 

    couchdb.<<database_name>>
           .<<design_doc_name>>
            .<<handler_name>
           .<<method>>
           .<<http_method>>(options, callback)

See [options](#options) for what is allowed in options. callback is of the form: `callback(error, response, body)` where `response` is the unadulterated response from the CouchDB server and `body` is a javascript object parsed from the JSON response body.

There are some [helper functions] described below that have slightly different usage patterns.

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

After we have generated the API with defaults:

    couchdb = require('YACA');
    
    callback = function(error, response, body) {console.log(error, body)}
    // create new document
    couchdb.primarydb.put({uri:'doc2',json:{field1:'hello'}}, callback)

    // view existing document
    couchdb.primarydb.get('doc1', callback);
    
    // edit existing document
    couchdb.primarydb.put(  { uri:'doc2'
                            , json:{ field1:'goodbye'
                                   , _rev:'34_434c5f645'
                                   }
                            }
                          , callback
                          )

    // view all docs from a view
    couchdb.secondarydb.app.views.by_date.get(callback)

Hopefully this gives you a general idea of how the API works.

## API ##

### Errors ###
When couchdb returns any code greater than 299, the api returns a javascript option parsed from the CouchDB error response with the added field 'statusCode,' with the http StatusCode.

### Options ###
YACA is derived from request, and so it supports most of the options supported by request, and a few more

Options can be either a string representing the command you wish to execute, or it can be an options object.

The valid keys in the options object are:
* `uri` || `url` - The CouchDB command you wish to execute. the API will prepend the appropriate url for the root/database/design doc/handler method from which you are making the request.
* `body` - entity body for POST and PUT requests. Must be buffer or string.
* `json` - sets `body` but to JSON representation of value and adds `Content-type: application/json` header.
* `parse` - defaults to `true`, returned `body` will be a javascript object parsed from the JSON body.
* `admin` - provide basic auth admin credentials if provided to api generator.
* `query` - hash object of query parameters. api uses JSON.stringify on any non-string hash values. Then uses querystring.stringify on the entire hash.
* `auth` - *not yet supported.* provide the given basic auth credentials. value must be a string: `username:password`.
* `onResponse` - *not yet supported.*



### Standard API ###
All of the following API calls conform are passed an options argument and a callback. The callback is then called with three arguments: an error, the CouchDB http response, and a javascript object parsed from the CouchDB response

#### CouchDB Root ####
* couchdb(options, callback) - same as .get
* couchdb.get(options, callback)
* couchdb.post(options, callback)
* couchdb.put(options, callback)
* couchdb.del(options, callback)

#### Database ####
* couchdb.<<db>>(options, callback) - same as .get
* couchdb.<<db>>.get(options, callback)
* couchdb.<<db>>.post(options, callback)
* couchdb.<<db>>.put(options, callback)
* couchdb.<<db>>.del(options, callback)

Where <<db>> is the name of the database. if your database name is a protected word, the YACA generator will notify you, and <<db>> will be your database name prepended with '__' (two underscores).

#### Design Documents ####
* couchdb.<<db>>.<<ddoc>>(options, callback) - same as .get
* couchdb.<<db>>.<<ddoc>>.get(options, callback)
* couchdb.<<db>>.<<ddoc>>.post(options, callback)
* couchdb.<<db>>.<<ddoc>>.put(options, callback)
* couchdb.<<db>>.<<ddoc>>.del(options, callback)

Where <<db>> is as described above, and <<ddoc>> is the _id of your design doc stripped of the '_design/'.

#### Views ####
* couchdb.<<db>>.<<ddoc>>.views.<<method>>.get(options, callback)
* couchdb.<<db>>.<<ddoc>>.views.<<method>>.post(options, callback)

#### Shows ####
* couchdb.<<db>>.<<ddoc>>.shows.<<method>>(options, callback) - same as .get
* couchdb.<<db>>.<<ddoc>>.shows.<<method>>.get(options, callback)
* couchdb.<<db>>.<<ddoc>>.shows.<<method>>.post(options, callback)

#### Lists ####
* couchdb.<<db>>.<<ddoc>>.lists.<<method>>.get(options, callback) - same as .get
* couchdb.<<db>>.<<ddoc>>.lists.<<method>>.post(options, callback)

#### Updates ####
* couchdb.<<db>>.<<ddoc>>.updates.<<method>>.put(options, callback)
* couchdb.<<db>>.<<ddoc>>.updates.<<method>>.post(options, callback)

#### Rewrites ####
* couchdb.<<db>>.<<ddoc>>.rewrites.<<method>>(options, callback) - same as .get
* couchdb.<<db>>.<<ddoc>>.rewrites.<<method>>.get(options, callback)
* couchdb.<<db>>.<<ddoc>>.rewrites.<<method>>.pust(options, callback)
* couchdb.<<db>>.<<ddoc>>.rewrites.<<method>>.post(options, callback)
* couchdb.<<db>>.<<ddoc>>.rewrites.<<method>>.del(options, callback)

### Helper API ###
Anything you can do with the helper APIs you can do with the standard API. For example, you could get uuids in either of the two following ways:

    couchdb._uuids(3, callback(e, b) {console.log(b)})
    // response: [<<uuid1>>, <<uuid2>>, <<uuid3>>]

    couchdb.get( {uri:'_uuid',query:{count:'3'}}
               , callback(e, r, b) {console.log(b)})
    // response: {uuids: [<<uuid1>>, <<uuid2>>, <<uuid3>>]}

As you can see, the helper functions simply reduce the verbosity. But if you are already familiar with the couchdb apis, it might simply be easier to use the standard API, rather than having to refer to the helper api.

#### CouchDB Root ####
* couchdb._uuids([count], callback(error, uuids))
  * `count` - number of uuids to return - defaults to 1
  * `uuids` - list of uuids returned by CouchDB

#### Updates ####
* couchdb.<<db>>.<<ddoc>>.updates.<<method>>(json, callback)
  * `json` - body to send to the update
  * returns standard (error, response, body) to the callback

### Views ###
* couchdb.<<db>>.<<ddoc>>.views.<<method>>(query, callback)
  * `query` - query parameters to pass to the view
  * returns standard (error, response, body) to the callback

  

