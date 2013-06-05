require([
            'dojo/_base/array',
            'JBrowse/Model/XHRBlob',
            'JBrowse/Util/GFF3',
            'JBrowse/Store/SeqFeature/GFF3/Parser'
        ], function( array, XHRBlob, GFF3, Parser ) {
describe( 'GFF3 utils', function() {
    array.forEach([
                      ['foo=bar', { foo: ['bar'] }],
                      ['ID=Beep%2Cbonk%3B+Foo\n', { ID: ['Beep,bonk;+Foo'] }]
                  ],
                  function( testcase ) {
                      it( 'parses attr string "'+testcase[0]+'" correctly', function() {
                              expect( GFF3.parse_attributes(testcase[0]) ).toEqual( testcase[1] );
                      });
                  });


    array.forEach([
                      [
                          "FooSeq\tbarsource\tmatch\t234\t234\t0\t+\t.\tID=Beep%2Cbonk%3B+Foo\n",
                          {
                              'attributes' : {
                                  'ID' : [
                                      'Beep,bonk;+Foo'
                                  ]
                              },
                              'end' : 234,
                              'phase' : undefined,
                              'score' : 0,
                              'seq_id' : 'FooSeq',
                              'source' : 'barsource',
                              'start' : 234,
                              'strand' : '+',
                              'type' : 'match'
                          }
                      ],
                      [
                          GFF3.escape("Noggin,+-\%Foo\tbar")+"\tbarsource\tmatch\t234\t234\t0\t+\t.\t.\n",
                          {
                              'attributes' : {},
                              'end' : 234,
                              'phase' : undefined,
                              'score' : 0,
                              'seq_id' : "Noggin,+-\%Foo\tbar",
                              'source' : 'barsource',
                              'start' : 234,
                              'strand' : '+',
                              'type' : 'match'
                          }
                      ]
                  ],
                  function( testcase ) {
                      it( 'roundtrips feature line "'+testcase[0]+'" correctly', function() {
                              expect( GFF3.parse_feature( testcase[0] ) ).toEqual( testcase[1] );
                              expect( GFF3.format_feature( testcase[1] ) ).toEqual( testcase[0] );
                              expect( GFF3.format_feature( GFF3.parse_feature( testcase[0] ) ) ).toEqual( testcase[0] );
                              expect( GFF3.parse_feature( GFF3.format_feature( testcase[1] ) ) ).toEqual( testcase[1] );
                      });
                  });

});

describe( 'GFF3 parser', function() {
   it( 'can parse gff3_with_syncs.gff3', function() {
           // get the gff3 file
           var f = new XHRBlob( '../data/gff3_with_syncs.gff3' );
           var lines = [];
           var done;
           f.fetchLines( function(l) { lines.push(l); },
                         function() { done=true; },
                         function(e) { console.error(e); } );
           waitsFor( function() { return done; } );
           runs( function() {
                     var p = new Parser({ iterators: [ function() {
                                                           return lines.shift();
                                                       }]
                                        });
                     var features = [];
                     var f;
                     while(( f=p.next_item() )) {
                         features.push( f );
                     }
                     expect( features ).toEqual( [] );
           });
   });
});

});
