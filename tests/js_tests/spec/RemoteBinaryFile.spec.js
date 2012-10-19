require(['JBrowse/Store/RemoteBinaryFile','dojo/aspect'], function( RemoteBinaryFile, aspect ) {

    describe( 'RemoteBinaryFile', function() {
        var b = new RemoteBinaryFile({
            name: 'tester',
            minChunkSize: 1
        });
        var bamURL = '../../sample_data/raw/volvox/volvox-sorted.bam';

        it( 'constructs', function(){ expect(b).toBeTruthy(); });

        it( 'appears to fetch data correctly', function() {
               var get = function( start, end, callback ) {
                   var data;
                   b.get({ url: bamURL, start: start, end: end, success: function(d) { data = d; } });
                   waitsFor( function() { return data; } );
                   runs( function() { callback(data); } );
               };
               get( 0, 4000, function( data ) {
                        expect( data.byteLength ).toEqual( 4001 );
                        expect( b._fetchCount ).toEqual(1);
                        get( 1000, 2000, function( data ) {
                                 expect( data.byteLength).toEqual( 1001 );
                                 expect( b._fetchCount ).toEqual(1);
                                 get( 4000, 4000, function( data ) {
                                          expect( data.byteLength ).toEqual( 1 );
                                          expect( b._fetchCount ).toEqual(1);
                                          get( 4000, 4000, function( data ) {
                                                   expect( data.byteLength ).toEqual( 1 );
                                                   expect( b._fetchCount ).toEqual(1);
                                               });
                                      });
                             });
                    });
           });
              });
        });