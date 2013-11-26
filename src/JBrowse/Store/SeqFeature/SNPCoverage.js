/**
 * Store that encapsulates another store, which is expected to have
 * features in it that have CIGAR and MD attributes.  Produces
 * features that include SNP allele frequencies.
 */

define([
           'dojo/_base/declare',
           'dojo/_base/array',
           'JBrowse/Store/SeqFeature',
           'JBrowse/Model/NestedFrequencyTable',
           'JBrowse/Model/CoverageFeature',
           './_MismatchesMixin'
       ],
       function(
           declare,
           array,
           SeqFeatureStore,
           NestedFrequencyTable,
           CoverageFeature,
           MismatchesMixin
       ) {

return declare( [ SeqFeatureStore, MismatchesMixin ], {

    constructor: function( args ) {
        this.store = args.store;
        this.filter = args.filter || function() { return true; };
    },

    getGlobalStats: function( callback, errorCallback ) {
        callback( {} );
    },

    getFeatures: function( query, featureCallback, finishCallback, errorCallback ) {
        var thisB = this;
        var leftBase  = query.start;
        var rightBase = query.end;
        var scale = query.scale || query.basesPerSpan && 1/query.basesPerSpan || 10; // px/bp
        var widthBp = rightBase-leftBase;
        var widthPx = widthBp * scale;

        var binWidth = function() {
            var bpPerPixel = 1/scale;
            if( bpPerPixel <= 30 ) {
                return 1;
            } else {
                return Math.ceil( bpPerPixel );
            }
        }();

        function binNumber( bp ) {
            return Math.floor( (bp-leftBase) / binWidth );
        };

        // init coverage bins
        var binMax = Math.ceil( (rightBase-leftBase)/binWidth );
        var coverageBins = new Array( binMax );
        for( var i = 0; i < binMax; i++ ) {
            coverageBins[i] = new NestedFrequencyTable();
            if( binWidth == 1 )
                coverageBins[i].snpsCounted = true;
        }

        function forEachBin( feature, callback ) {
            var s = (feature.get('start') - leftBase)/binWidth;
            var e = (feature.get('end')-1 - leftBase)/binWidth;
            var sb = Math.floor(s),
                eb = Math.floor(e);

            if( sb >= binMax || eb < 0 )
                return; // does not overlap this block

            // enforce 0 <= bin < binMax
            if( sb < 0 )
                s = sb = 0;
            if( eb >= binMax ) {
                eb = binMax-1;
                e  = binMax;
            }

            // now iterate
            if( sb == eb ) // if in the same bin, just one call
                callback( sb, e-s );
            else { // if in different bins, two or more calls
                callback( sb, sb+1-s );
                for( var i = sb+1; i < eb; i++ )
                    callback( i, 1 );
                callback( eb, e-eb );
            }
        };

        thisB.store.getFeatures(
            query,
            function( feature ) {
                if( ! thisB.filter( feature ) )
                    return;

                // if the bin width is smallish, calculate coverage using subfeatures
                var coverageFeatures = binWidth == 1 && feature.children();
                if( !( coverageFeatures && coverageFeatures.length ))
                    coverageFeatures = [ feature ];

                // calculate total coverage
                array.forEach( coverageFeatures, function( feature ) {
                    // increment start and end partial-overlap bins by proportion of overlap
                    forEachBin( feature, function( bin, overlap ) {
                        coverageBins[bin].increment( 'reference', overlap );
                    });
                });

                // Calculate SNP coverage
                if( binWidth == 1 ) {
                    var mismatches = thisB._getMismatches( feature );
                    // loops through mismatches and updates coverage variables accordingly.
                    for (var i = 0; i < mismatches.length; i++) {
                        var mismatch = mismatches[i];
                        if( ! { mismatch:true, insertion:true, deletion: true }[mismatch.type] )
                            return;

                        var bin = coverageBins[ binNumber( feature.get('start') + mismatch.start ) ];
                        if( bin ) {
                            var strand = { '-1': '-', '1': '+' }[ ''+feature.get('strand') ] || 'unstranded';
                            // Note: we decrement 'reference' so that total of the score is the total coverage
                            bin.decrement( 'reference', 1 );
                            var base = mismatch.base;
                            if( mismatch.type == 'insertion' )
                                base = 'ins '+base;
                            bin.getNested( base ).increment( strand, 1 );
                        }
                    }
                }
            },
            function ( args ) {
                var makeFeatures = function() {
                    // make fake features from the coverage
                    for( var i = 0; i < coverageBins.length; i++ ) {
                        var bpOffset = leftBase+binWidth*i;
                        featureCallback( new CoverageFeature({
                                                                 start: bpOffset,
                                                                 end:   bpOffset+binWidth,
                                                                 score: coverageBins[i]
                                                             }));
                    }
                    finishCallback( args ); // optional arguments may change callback behaviour (e.g. add masking)
                };

                // if we are zoomed to base level, try to fetch the
                // reference sequence for this region and record each
                // of the bases in the coverage bins
                if( binWidth == 1 ) {
                    var sequence;
                    thisB.browser.getStore(
                        'refseqs', function( refSeqStore ) {
                            if( refSeqStore ) {
                                refSeqStore.getFeatures(
                                    query,
                                    function(f) {
                                        sequence = f.get('seq');
                                    },
                                    function() {
                                        if( sequence ) {
                                            for( var base = leftBase; base <= rightBase; base++ ) {
                                                var bin = binNumber( base );
                                                coverageBins[bin].refBase = sequence[bin];
                                            }
                                        }
                                        makeFeatures();
                                    },
                                    makeFeatures
                                );
                            } else {
                                makeFeatures();
                            }
                        });
                }
                else {
                    makeFeatures();
                }
            }
            , errorCallback
        );
    }
});
});
