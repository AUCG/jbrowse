/**
 * Each JBrowse component has a Configuration.
 *
 * Each configuration has a number of Slots, each of which has a name
 * like "foo.bar.baz", a value, and some other properties that
 * describe it.
 *
 * Each Slot also has metadata that records the relative path of the
 * config file it was loaded from, if any.
 */

define( [
            'dojo/_base/declare',
            'dojo/_base/lang'
        ],
        function(
            declare,
            lang
        ) {

var Configuration = declare( null, {

    constructor: function( schema, base ) {
        this._base  = {};
        this._local = {};
        this._compilationCache = {};

        if( ! schema )
            throw new Error('must provide a schema to Configuration constructor');

        this._schema = schema;

        if( base )
            this.loadBase( base );
    },

    set: function( key, val ) {
        this._local[ key ] = this._schema.normalizeSetting( key, val );
        delete this._compilationCache[ key ];
        return this._local[key];
    },

    /**
     * Given a dot-separated string configuration path into the config
     * (e.g. "style.bg_color"), get the value of the configuration.
     *
     * If args are given, evaluate the configuration using them.
     * Otherwise, return a function that returns the value of the
     * configuration when called.
     */
    get: function( key, args ) {
        return this.getFunc( key ).apply( this, args );
    },

    getFunc: function( key ) {
        return this._compilationCache[ key ] || ( this._compilationCache[ key ] = this._compile( key ) );
    },

    _compile: function( key ) {
        var confVal = this.getRaw( key );

        return typeof confVal == 'function'
            ? confVal
            : function() { return confVal; };
    },

    getRaw: function( key ) {
        return key in this._local ? this._local[ key ] :
               key in this._base  ? this._base[key] :
                                    this._schema.getDefaultValue( key );
    },

    /**
     * Load the given base configuration, overwriting any existing
     * values.
     */
    loadBase: function( input ) {
        this._loadBase( input, this._base, '' );
    },
    _loadBase: function( input, targetConf, path ) {
        for( var k in input ) {
            var fullKey = path+k;
            var v = input[k];
            if( v === undefined )
                continue;

            var slot = this._schema.getSlot( fullKey );
            if( slot ) {
                targetConf[ fullKey ] = typeof v == 'function' ? slot.normalizeFunction( v, this )
                                                               : slot.normalizeValue( v, this );
            }
            else if( typeof v == 'object' && ! lang.isArray(v) ) {
                this._loadBase( v, targetConf, fullKey+'.' );
            }
            else {
                //throw new Error( 'Unknown configuration key '+fullKey );
                console.error( 'Unknown configuration key "'+fullKey+'", ignoring.' );
            }
        }
    },

    /**
     * Load the given local configuration, overwriting any existing
     * values.
     */
    loadLocal: function( conf, keyBase ) {
        // TODO: implement this
    },

    /**
     * Validate and possibly munge the given value before setting.
     * NOTE: Throw an Error object if it's invalid.
     */
    normalizeSetting: function( key, val ) {
        return this._schema.normalizeSetting( key, val, this );
    },

   /**
    * Get a nested object containing all the locally-set configuration
    * data for this configuration.
    */
    exportLocal: function() {
        return this._flatToNested( this._local );
    },

    /**
     * Get a nested object containing the base configuration data.
     */
    exportBase: function() {
        return this._flatToNested( this._base );
    },

    /**
     * Get a new base for this configuration, with the local settings merged in.
     */
    exportMerged: function() {
        return this._flatToNested( lang.mixin( {}, this._base, this._local ) );
    },

    // convert a flat config object { 'foo.bar.baz' : 42, ... } to a
    // nested config object like { foo: { bar: { baz: 42 } } }
    _flatToNested: function( flatconf ) {

        function _set(conf,path,val) {
            if( path.length > 1 ) {
                var k = path.shift();
                var sub = conf[k];
                if( ! sub )
                    sub = conf[k] = {};
                _set( sub, path, val );
            } else {
                conf[ path[0] ] = val;
            }
        }

        var nested = {};
        for( var k in flatconf ) {
            var path = k.split('.');
            _set( nested, path, flatconf[k] );
        }

        return nested;
    }
});

return Configuration;
});


// == schema : nested object specifying what slots a configuration has, and
// their default values.  usually hardcoded.

// == base: nested object specifying a new set of default values for the
// spec.  values in there that do not match a spec are ignored

// == local: nested object specifying the value that have been set
// locally in this browser or by this user.  should be persisted in
// local storage and in cloud accounts if available.