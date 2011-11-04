// Derived from code kindly provided by Raynos (https://github.com/Raynos)

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
	    return f.call.apply(f, arguments);      
	};
	Object.keys(proto).forEach(function (key) {
	    f[key] = proto[key];
	});
	f.constructor.apply(f, arguments);
	return f;
    }
}

module.exports = proto_factory_factory