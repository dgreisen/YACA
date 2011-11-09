var factory = require('./factory');
var factory_factory = factory.factory_sync;
var proto_helper = factory.proto_helper;
var constructor_helper = factory.constructor_helper;
var child_constructor = factory.child_constructor;

// ** Methods **
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

// ** DDOC **
var proto_ddoc = proto_helper(['get', 'put', 'post', 'del'], 'get');
proto_ddoc.constructor = function(cache) {
  constructor_helper.apply(this, [cache]);
  for (handler_name in cache.children) {
    this[handler_name] = {};
    that = this[handler_name];
    child_constructor.apply( that
                           , [ cache.children[handler_name]
                             , method_factories[handler_name]
                             ]
                           );
  }
}
var ddoc_factory = factory_factory(proto_ddoc)

// ** database**
var proto_db = proto_helper(['get', 'put', 'post', 'del'], 'get');

proto_db.constructor = function(cache) {
  constructor_helper.apply(this, [cache]);
  child_constructor.apply(this, [cache, ddoc_factory]);
}

proto_db._new_doc = function(json, callback)


var db_factory = factory_factory(proto_db)



module.exports = db_factory;
