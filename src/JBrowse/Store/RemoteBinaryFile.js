define([
           'dojo/_base/declare',
           'dojo/_base/array',
           'JBrowse/Store/LRUCache',
           'jszlib/arrayCopy'
       ],
       function( declare, array, LRUCache, arrayCopy ) {

// contains chunks of files, stitches them together if necessary, wraps, and returns them
// to satisfy requests
return declare( null,

/**
 * @lends JBrowse.Store.RemoteBinaryFile
 */
{
    constructor: function( args ) {
        this.name = args.name;

        this._fetchCount = 0;
        this._arrayCopyCount = 0;

        this.minChunkSize = 'minChunkSize' in args ? args.minChunkSize : 65536;
        this.chunkCache = new LRUCache({
            name: args.name + ' chunk cache',
            fillCallback: dojo.hitch( this, '_fetch' )
        });

        this.totalSizes = {};
    },

    _escapeRegExp: function(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    },

    _relevantExistingChunks: function( url, start, end ) {
        // we can't actually use any existing chunks if we don't have an
        // end defined.  not possible in the HTTP spec to ask for all except
        // the first X bytes of a file
        if( !end )
            return [];

        start = start || 0;

        var fileChunks = this.chunkCache
                .query( new RegExp( '^'+this._escapeRegExp( url + ' (bytes' ) ) );

        // set 'start' and 'end' on any records that don't have them, but should
        array.forEach( fileChunks, function(c) {
                           if( c.size ) {
                               if( ! c.key.start )
                                   c.key.start = 0;
                               if( ! c.key.end )
                                   c.key.end = c.key.start + ( c.size || c.value.byteLength );
                           }
                       });

        // sort the records by start coordinate, then by length descending (so that we preferentially use big chunks)
        fileChunks = fileChunks.sort( function( a, b ) {
            return ( a.key.start - b.key.start ) || ((b.key.end - b.key.start) - ( a.key.end - a.key.start ));
        });

        // filter for the chunks that can actually be used for this request
        return array.filter( fileChunks,
                             function( chunk ) {
                                 return !( chunk.key.start > end || chunk.key.end < start );
                             }, this);
    },

    _fetchChunks: function( url, start, end, callback ) {
        start = start || 0;

        // // if we already know how big the file is, use that information for the end
        if( typeof end != 'number' && this.totalSizes[url] ) {
            end = this.totalSizes[ url ]-1;
        }
        // // NOTE: if end is undefined, take that to mean fetch all the way to the end of the file


        this._log( '_fetchChunks', url, start, end );

        // what chunks do we already have in the chunk cache?
        var existingChunks = this._relevantExistingChunks( url, start, end );
        this._log( 'existing', existingChunks );

        var needed = [];
        var currIndex = start;
        var goldenPath = [];
        var chunkToString = function() {
            return this.url+" (bytes "+this.start+".."+this.end+")";
        };

        array.forEach( existingChunks, function( chunk, i ) {

                           if( !end               // can't use any existing chunks if we have no end specified,
                               || currIndex > end // skip the rest if we already have our golden path
                               || chunk.key.end < currIndex // skip this one if we have already gone past it
                             ) {
                               return;
                           }

                           if( chunk.key.start > currIndex ) {
                               // we need to get a chunk for the range before this chunk
                               var n = {
                                   key: {
                                       url:   url,
                                       start: currIndex,
                                       end:   currIndex + Math.max( this.minChunkSize, chunk.key.start - currIndex ) - 1,
                                       toString: chunkToString
                                   }
                               };

                               // if the previous chunk we need is
                               // close to this chunk, just merge them
                               // and get it all in one request
                               if( needed.length
                                   && (n.key.start - needed[ needed.length-1 ].key.end) < this.minChunkSize ) {
                                  needed[ needed.length-1 ].key.end = n.key.end;
                                  // this merge might have rendered the previous chunk on the golden path unnecessary
                                  if( goldenPath[ goldenPath.length-1 ].key.end < n.key.end ) {
                                      goldenPath.pop();
                                  }
                               }
                               else {
                                  needed.push( n );
                                  goldenPath.push( n );
                               }

                               currIndex = n.key.end + 1;
                           }

                           if( chunk.key.start <= currIndex && chunk.key.end >= currIndex ) {
                               this.chunkCache.touch( chunk );
                               goldenPath.push( chunk );
                           }

                           currIndex = goldenPath[ goldenPath.length - 1].key.end + 1;
        },this);

        if( !existingChunks.length || currIndex <= end ) {
            needed.push({ key: {
                              url: url,
                              start: currIndex,
                              end: end ? Math.max( currIndex+this.minChunkSize-1, end ) : undefined,
                              toString: chunkToString
                          }
                        });
            goldenPath.push( needed[needed.length-1] );
        }

        this._log( 'needed', needed );

        // now fetch all the needed chunks
        // remember that chunk records in the 'needed' array are also
        // present in the 'goldenPath' array, so setting their value
        // will affect both places
        if( needed.length ) {
            var fetchedCount = 0;
            array.forEach( needed, function( c ) {
                this.chunkCache.get( c.key, function( data ) {
                    c.value = data;
                    if( ++fetchedCount == needed.length )
                        callback( goldenPath );
                });
            }, this );
        }
        // or we might already have all the chunks we need
        else {
            callback( goldenPath );
        }
    },

    _fetch: function( request, callback, attempt, truncatedLength ) {

        this._log( 'fetch', request.url, request.start, request.end );
        this._fetchCount++;

        attempt = attempt || 1;
        if( attempt > 3 ) {
            callback(null);
            return;
        }

        var req = new XMLHttpRequest();
        var length;
        req.open('GET', request.url, true);
        if( req.overrideMimeType )
            req.overrideMimeType('text/plain; charset=x-user-defined');
        if (request.end) {
            req.setRequestHeader('Range', 'bytes=' + request.start + '-' + request.end);
            length = request.end - request.start + 1;
        }
        req.responseType = 'arraybuffer';

        var respond = function( response ) {
            if( response ) {
                if( ! request.start )
                    request.start = 0;
                if( ! request.end )
                    request.end = response.byteLength;
            }
            callback( response );
        };

        req.onreadystatechange = dojo.hitch( this, function() {
            if (req.readyState == 4) {
                if (req.status == 200 || req.status == 206) {

                    // if this response tells us the file's total size, remember that
                    this.totalSizes[request.url] = (function() {
                        var contentRange = req.getResponseHeader('Content-Range');
                        if( ! contentRange )
                            return undefined;
                        var match = contentRange.match(/\/(\d+)$/);
                        return match ? parseInt(match[1]) : undefined;
                    })();

                    var response = req.response || req.mozResponseArrayBuffer || (function() {
                        try{
                            var r = req.responseText;
                            if (length && length != r.length && (!truncatedLength || r.length != truncatedLength)) {
                                this._fetch( request, callback, attempt + 1, r.length );
                                return;
                            } else {
                                respond( this._stringToBuffer(req.responseText) );
                                return;
                            }
                        } catch (x) {
                            console.error(''+x);
                            respond( null );
                            return;
                        }
                    }).call(this);
                    if( response ) {
                        callback( response );
                    }
                } else {
                    return this._fetch( request, callback, attempt + 1);
                }
            }
            return null;
        });
        // if (this.opts.credentials) {
        //     req.withCredentials = true;
        //  }
        req.send('');
    },

    /**
     * @param args.url
     * @param args.start
     * @param args.end
     * @param args.success
     */
    get: function( args ) {
        this._log( 'get', args.url, args.start, args.end );

        var start = args.start || 0;
        var end = args.end;
        if( start && !end )
            throw "cannot specify a fetch start without a fetch end";

        this._fetchChunks( args.url, start, end, dojo.hitch( this, function( chunks ) {
            this._log( 'golden path', chunks);

            var fetchLength = end ? end - start + 1 // use start end end if we have it
                                  : Math.max.apply( Math, // otherwise calculate from the end offsets of the chunks
                                                    array.map(
                                                        chunks,
                                                        function(c) {
                                                            return c.key.end ||
                                                                // and possibly calculate the end offset of the chunk from its start + its length
                                                                (c.key.start + c.value.byteLength);
                                                        })
                                                  ) + 1;


            var returnBuffer;

            // if we just have one chunk, return either it, or a subarray of it.  don't have to do any array copying
            if( chunks.length == 1 && chunks[0].key.start == start ) {
                returnBuffer = chunks[0].value;
            } else {
                // stitch them together into one ArrayBuffer to return
                returnBuffer = new Uint8Array( fetchLength );
                var cursor = 0;
                array.forEach( chunks, function( chunk ) {
                    var b = new Uint8Array( chunk.value );
                    var bOffset = (start+cursor) - chunk.key.start; if( bOffset < 0 ) this._error('chunking error');
                    var length = Math.min( b.byteLength - bOffset, fetchLength - cursor );
                    this._log( 'arrayCopy', b, bOffset, returnBuffer, cursor, length );
                    arrayCopy( b, bOffset, returnBuffer, cursor, length );
                    this._arrayCopyCount++;
                    cursor += length;
                },this);
                returnBuffer = returnBuffer.buffer;
            }

            // return the data buffer
            args.success( returnBuffer );
        }));
    },

    _stringToBuffer: function(result) {
        if( ! result || typeof Uint8Array != 'function' )
            return null;

        var ba = new Uint8Array( result.length );
        for ( var i = 0; i < ba.length; i++ ) {
            ba[i] = result.charCodeAt(i);
        }
        return ba.buffer;
    },

    _log: function() {
        //console.log.apply( console, this._logf.apply(this,arguments) );
    },
    _warn: function() {
        console.warn.apply( console, this._logf.apply(this,arguments) );
    },
    _error: function() {
        console.error.apply( console,  this._logf.apply(this,arguments) );
        throw 'file error';
    },
    _logf: function() {
        arguments[0] = this.name+' '+arguments[0];
        if( typeof arguments[0] == 'string' )
            while( arguments[0].length < 15 )
                arguments[0] += ' ';
        return arguments;
    }

});
});