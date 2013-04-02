/**
 * Functions for parsing MD and CIGAR strings.
 */
define([
           'dojo/_base/declare',
           'dojo/_base/array'
        ],
        function(
            declare,
            array
        ) {

return declare( null, {

    constructor: function() {
        this.cigarAttributeName = ( this.config.cigarAttribute || 'cigar' ).toLowerCase();
        this.mdAttributeName    = ( this.config.mdAttribute    || 'md'    ).toLowerCase();
    },

    _getMismatches: function( feature ) {
        var mismatches = [];

        // parse the CIGAR tag if it has one
        var cigarString = feature.get( this.cigarAttributeName );
        if( cigarString ) {
            mismatches.push.apply( mismatches, this._cigarToMismatches( feature, cigarString ) );
        }

        // parse the MD tag if it has one
        var mdString = feature.get( this.mdAttributeName );
        if( mdString )  {
            mismatches.push.apply( mismatches, this._mdToMismatches( feature, mdString ) );
        }

        return mismatches;
    },

    _parseCigar: function( cigar ) {
        return array.map( cigar.match(/\d+\D/g), function( op ) {
           return [ op.match(/\D/)[0].toUpperCase(), parseInt( op ) ];
        });
    },

    _cigarToMismatches: function( feature, cigarstring ) {
        var ops = this._parseCigar( cigarstring );
        var currOffset = 0;
        var mismatches = [];
        array.forEach( ops, function( oprec ) {
           var op  = oprec[0].toUpperCase();
           if( !op )
               return;
           var len = oprec[1];
           // if( op == 'M' || op == '=' || op == 'E' ) {
           //     // nothing
           // }
           if( op == 'I' )
               mismatches.push( { start: currOffset, type: 'insertion', base: ''+len, length: 1 });
           else if( op == 'D' )
               mismatches.push( { start: currOffset, type: 'deletion',  base: '*', length: len  });
           else if( op == 'N' )
               mismatches.push( { start: currOffset, type: 'skip',      base: 'N', length: len  });
           else if( op == 'X' )
               mismatches.push( { start: currOffset, type: 'mismatch',  base: 'X', length: len  });

           if( op != 'I' && op != 'S' && op != 'H' )
               currOffset += len;
        });
        return mismatches;
    },

    /**
     * parse a SAM MD tag to find mismatching bases of the template versus the reference
     * @returns {Array[Object]} array of mismatches and their positions
     * @private
     */
    _mdToMismatches: function( feature, mdstring ) {
        var mismatchRecords = [];
        var curr = { start: 0, base: '', length: 0, type: 'mismatch' };
        var seq = feature.get('seq');
        var nextRecord = function() {
              mismatchRecords.push( curr );
              curr = { start: curr.start + curr.length, length: 0, base: '', type: 'mismatch'};
        };
        array.forEach( mdstring.match(/(\d+|\^[a-z]+|[a-z])/ig), function( token ) {
          if( token.match(/^\d/) ) { // matching bases
              curr.start += parseInt( token );
          }
          else if( token.match(/^\^/) ) { // insertion in the template
              curr.length = token.length-1;
              curr.base   = '*';
              curr.type   = 'deletion';
              nextRecord();
          }
          else if( token.match(/^[a-z]/i) ) { // mismatch
              for( var i = 0; i<token.length; i++ ) {
                  curr.length = 1;
                  curr.base = seq ? seq.substr( curr.start, 1 ) : 'X';
                  nextRecord();
              }
          }
        });
        return mismatchRecords;
    }
});
});