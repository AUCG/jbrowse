define( [
            'dojo/_base/declare',
            'dojo/_base/array',
            'dojo/store/JsonRest',
            'dojo/store/util/QueryResults',
            'JBrowse/Digest/Crc32'
        ],
        function(
            declare,
            array,
            dojoJSONRest,
            QueryResults,
            digest
        ) {

return declare( null, {

    constructor: function( args ) {
        // make sure url has a trailing slash
        var url = /\/$/.test( args.url ) ? args.url : args.url + '/';
        this.bucketStore = new dojoJSONRest({
            target: url
        });
    },

    // case-insensitive, and supports prefix queries like 'foo*'
    query: function( query, options ) {
        // remove trailing asterisks from query.name
        var name = ( query.name || '' ).toString().toLowerCase();
        var trailingStar = /\*$/;
        if( trailingStar.test( name ) ) {
            return this._getBucket( name.replace( trailingStar, '' ) )
                       .then( function( bucket ) {
                            return QueryResults( ( bucket.exact || [] ).concat( bucket.prefix || [] ) );
                        });
        }
        else {
            return this._getBucket( name )
                       .then( function( bucket ) {
                           return QueryResults( bucket.exact || [] );
                       });
        }
    },

    get: function( id ) {
        return this._getBucket( id )
                   .then( function( bucket ) {
                       return (bucket.exact||[])[0] || null;
                   });
    },

    _getBucket: function( key ) {
        var thisObj = this;

        var bucketIdent = this._hash( key );

        // remember that then() returns a new Deferred that fires after
        // the callback of the then()
        return this.bucketStore.get( this._hexToDirPath( bucketIdent ) );
    },

    _hexToDirPath: function( hex ) {
        // zero-pad the hex string to be 8 chars if necessary
        while( hex.length < 8 )
            hex = '0'+hex;
        var dirpath = [];
        for( var i = 0; i < hex.length; i += 3 ) {
            dirpath.push( hex.substring( i, i+3 ) );
        }
        return dirpath.join('/');
    },

    _hash: function( data ) {
        return digest.objectFingerprint( data )
                     .toString(16)
                     .toLowerCase()
                     .replace('-','n');
    },

    getIdentity: function( object ) {
        return object.id;
    }
});
});