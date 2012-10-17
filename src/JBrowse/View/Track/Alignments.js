define( ['dojo/_base/declare',
         'dojo/_base/array',
         'JBrowse/View/Track/HTMLFeatures'
        ],
        function( declare, array, HTMLFeatures ) {

return declare( HTMLFeatures,
/**
 * @lends JBrowse.View.Track.Alignments
 */
{

    constructor: function() {
    },

    renderFeature: function(feature, uniqueId, block, scale, containerStart, containerEnd, destBlock ) {
        var featDiv = this.inherited( arguments );
        this._drawMismatches( feature, featDiv, scale );
        return featDiv;
    },

    _drawMismatches: function( feature, featDiv, scale ) {
        // recall: scale is pixels/basepair
        if ( scale >= 1 ) {
            var mismatches = this._getMismatches( feature );
            var charSize = this.getCharacterMeasurements();
            var drawChars = scale >= charSize.w;

            array.forEach( mismatches, function( mismatch ) {
                array.forEach( mismatch.bases, function( base, i ) {
                    dojo.create('span', {
                                    className: 'mismatch base base_'+base.toLowerCase(),
                                    style: {
                                        position: 'absolute',
                                        left: scale * (mismatch.start+i) + 'px',
                                        width: scale + 'px',
                                        height: '1.2em',
                                        top: '50%',
                                        marginTop: '-0.6em'
                                    },
                                    innerHTML: drawChars ? base : ''
                                }, featDiv );
               }, this );
            });
        }
    },

    _getMismatches: function( feature ) {
        var seq = feature.get('seq');
        if( ! seq )
            return m;

        // parse the MD tag if it has one
        var mdTag = feature.get('MD');
        if( mdTag ) {
            return this._mdToMismatches( feature, mdTag );
        }

        return [];
    },

    /**
     * parse a SAM MD tag to find mismatching bases of the template versus the reference
     * @returns {Array[Object]} array of mismatches and their positions
     * @private
     */
    _mdToMismatches: function( feature, mdstring ) {
        var mismatchRecords = [];
        var curr = { start: 0, bases: '' };
        var seq = feature.get('seq');
        var nextRecord = function() {
              mismatchRecords.push( curr );
              curr = { start: curr.start + curr.bases.length, bases: ''};
        };
        array.forEach( mdstring.match(/(\d+|\^[a-z]+|[a-z])/ig), function( token ) {
          if( token.match(/^\d/) ) { // matching bases
              curr.start += parseInt( token );
          }
          else if( token.match(/^\^/) ) { // insertion in the template
              var i = token.length;
              while( i-- ) {
                  curr.bases += '*';
              }
              nextRecord();
          }
          else if( token.match(/^[a-z]/i) ) { // mismatch
              curr.bases = seq.substr( curr.start, token.length );
              nextRecord();
          }
        });
        return mismatchRecords;
    },

    // stub out subfeature rendering, this track doesn't render subfeatures
    renderSubfeature: function() {},

    /**
     * @returns {Object} containing <code>h</code> and <code>w</code>,
     *      in pixels, of the characters being used for sequences
     */
    getCharacterMeasurements: function() {
        if( !this._measurements )
            this._measurements = this._measureSequenceCharacterSize( this.div );
        return this._measurements;
    },

    /**
     * Conducts a test with DOM elements to measure sequence text width
     * and height.
     */
    _measureSequenceCharacterSize: function( containerElement ) {
        var widthTest = dojo.create('div', {
                                        innerHTML: '<span class="base mismatch">A</span>'
                                            +'<span class="base mismatch">C</span>'
                                            +'<span class="base mismatch">T</span>'
                                            +'<span class="base mismatch">G</span>'
                                            +'<span class="base mismatch">N</span>',
                                        style: {
                                            visibility: 'hidden',
                                            position: 'absolute',
                                            left: '0px'
                                        }
                                    }, containerElement );
        var result = {
            w:  widthTest.clientWidth / 5,
            h: widthTest.clientHeight
        };
        containerElement.removeChild(widthTest);
        return result;
    },


    /**
     * Make a default feature detail page for the given feature.
     * @returns {HTMLElement} feature detail page HTML
     */
    defaultFeatureDetail: function( /** JBrowse.Track */ track, /** Object */ f, /** HTMLElement */ div ) {
        var container = this.inherited( arguments );

        var fmt = dojo.hitch( this, '_fmtDetailField' );

        // if( f.get('strand') == -1 ) {
        //     dojo.create('div', { className: 'message', innerHTML: '' })
        // }
        var alignment = '<div class="alignment sequence">'+f.get('seq')+'</div>';
        if( f.get('seq') && f.get('qual') ) {
            container.innerHTML += fmt('Sequence quality scores', this._renderQual( f ) );
        }

        return container;
    },

    _renderQual: function( feature ) {

        var seq  = feature.get('seq'),
            qual = feature.get('qual');
        if( !seq || !qual )
            return '';

        qual = qual.split(/\s+/);
        var fieldWidth = (''+Math.max.apply( Math, qual )).length;

        // pad the sequence with spaces
        var seqPadding = ' ';
        while( seqPadding.length < fieldWidth-1 ) {
            seqPadding += ' ';
        }
        var paddedSeq = array.map( seq, function(s) {
            return s + seqPadding;
        });

        var tableRowHTML = function(fields, class_) {
            class_ = class_ ? ' class="'+class_+'"' : '';
            return '<tr'+class_+'>'+array.map( fields, function(f) { return '<td>'+f+'</td>'; }).join('')+'</tr>';
        };
        // insert newlines
        var rendered = '';
        var lineFields = Math.round(55/fieldWidth);
        while( paddedSeq.length ) {
            var line = paddedSeq.slice(0,Math.min( paddedSeq.length, lineFields ) );
            paddedSeq = paddedSeq.slice(lineFields);
            rendered += tableRowHTML( line, 'seq' );
            line = qual.slice(0, Math.min( qual.length, lineFields ));
            qual = qual.slice(lineFields);
            rendered += tableRowHTML( line, 'qual' );
        }
        return '<table class="baseQuality">'+rendered+'</table>';
    }
});
});