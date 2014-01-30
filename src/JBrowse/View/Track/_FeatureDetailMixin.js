/**
 * Mixin with methods for parsing making default feature detail dialogs.
 */
define([
           'dojo/_base/declare',
           'dojo/_base/array',
           'dojo/_base/lang',
           'dojo/aspect',
           'dojo/dom-construct',

           'JBrowse/has',
           'JBrowse/Util',
           'JBrowse/has!dom?JBrowse/View/DetailsMixin',
           'JBrowse/View/FASTA'
        ],
        function(
            declare,
            array,
            lang,
            aspect,
            domConstruct,

            has,
            Util,
            DetailsMixin,
            FASTAView
        ) {

return declare( has('dom') ? [DetailsMixin]: [], {

    constructor: function() {

        // clean up the eventHandlers at destruction time if possible
        if( typeof this.destroy == 'function' ) {
            aspect.before( this, 'destroy', function() {
                delete this.eventHandlers;
            });
        }
    },

    /**
     * Make a default feature detail page for the given feature.
     * @returns {HTMLElement} feature detail page HTML
     */
    defaultFeatureDetail: function( trackRenderer, /** Object */ f, fRect, container ) {
        if( ! container )
            container = domConstruct.create(
                'div', {
                    className: 'detail feature-detail feature-detail-'
                        +trackRenderer.get('widget').get('track').getCssClass()
                });

        this._renderCoreDetails( trackRenderer, f, fRect, container );

        this._renderAdditionalTagsDetail( trackRenderer, f, fRect, container  );

        this._renderUnderlyingReferenceSequence( trackRenderer, f, fRect, container );

        this._renderSubfeaturesDetail( trackRenderer, f, fRect, container );

        return container;
    },

    _renderCoreDetails: function( track, f, featDiv, container ) {
        var coreDetails = domConstruct.create(
            'div', {
                className: 'core',
                innerHTML: '<h2 class="sectiontitle">Primary Data</h2>'
            }, container );
        var fmt = lang.hitch( this, 'renderDetailField', coreDetails );

        fmt( 'Name', this.getFeatureLabel( f ) );
        fmt( 'Type', f.get('type') );
        fmt( 'Score', f.get('score') );
        fmt( 'Description', this.getFeatureDescription( f ) );
        fmt(
            'Position',
            Util.assembleLocString({ start: f.get('start'),
                                     end: f.get('end'),
                                     ref: f.get('seq_id'),
                                     strand: f.get('strand')
                                   })
        );
        fmt( 'Length', Util.addCommas(f.get('end')-f.get('start'))+' bp' );
    },

    // render any subfeatures this feature has
    _renderSubfeaturesDetail: function( track, f, featDiv, container ) {
        var subfeatures = f.get('subfeatures');
        if( subfeatures && subfeatures.length ) {
            this._subfeaturesDetail( track, subfeatures, container );
        }
    },

    _isReservedTag: function( t ) {
        return {name:1,start:1,end:1,strand:1,note:1,subfeatures:1,type:1,score:1}[t.toLowerCase()];
    },

    // render any additional tags as just key/value
    _renderAdditionalTagsDetail: function( track, f, featDiv, container ) {
        var additionalTags = array.filter( f.tags(), function(t) {
            return ! this._isReservedTag( t );
        },this);

        if( additionalTags.length ) {
            var atElement = domConstruct.create(
                'div',
                { className: 'additional',
                  innerHTML: '<h2 class="sectiontitle">Attributes</h2>'
                },
                container );
            array.forEach( additionalTags.sort(), function(t) {
                this.renderDetailField( container, t, f.get(t) );
            }, this );
        }
    },

    _renderUnderlyingReferenceSequence: function( trackRenderer, f, featDiv, container ) {

        // render the sequence underlying this feature if possible
        var field_container = domConstruct.create('div', { className: 'field_container feature_sequence' }, container );
        domConstruct.create( 'h2', { className: 'field feature_sequence', innerHTML: 'Region sequence', title: 'reference sequence underlying this '+(f.get('type') || 'feature') }, field_container );
        var valueContainerID = 'feature_sequence_'+this._uniqID();
        var valueContainer = domConstruct.create(
            'div', {
                id: valueContainerID,
                innerHTML: '<div style="height: 12em">Loading...</div>',
                className: 'value feature_sequence'
            }, field_container);
        var maxSize = this.getConf('maxFeatureSizeForUnderlyingRefSeq');
        if( maxSize < (f.get('end') - f.get('start')) ) {
            valueContainer.innerHTML = 'Not displaying underlying reference sequence, feature is longer than maximum of '+Util.humanReadableNumber(maxSize)+'bp';
        } else {
             trackRenderer.get('widget').get('genomeView').getReferenceSet()
                .then( function( refSeqStore ) {
                     if( refSeqStore ) {
                         refSeqStore.getReferenceSequences(
                             { ref: f.get('seq_id'), start: f.get('start'), end: f.get('end')}
                         ).forEach(
                             // feature callback
                             function( ref ) {
                                 // all this valueContainerID and
                                 // dojo.byID business is here because
                                 // the HTML is rewritten by the dojo
                                 // dialog parser, but this callback may be called either
                                 // before or after that happens.  if the fetch by
                                 // ID fails, we have come back before the parse.
                                 return ref.getSequence( f.get('start'), f.get('end') )
                                     .then( function( seq ) {
                                                valueContainer = dojo.byId(valueContainerID) || valueContainer;
                                                valueContainer.innerHTML = '';
                                                if( seq ) {
                                                    new FASTAView({ width: 62, htmlMaxRows: 10 })
                                                        .renderHTML(
                                                            { ref:   f.get('seq_id'),
                                                              start: f.get('start'),
                                                              end:   f.get('end'),
                                                              strand: f.get('strand'),
                                                              type: f.get('type')
                                                            },
                                                            f.get('strand') == -1 ? Util.revcom(seq) : seq,
                                                            valueContainer
                                                        );
                                                }
                                                else {
                                                    valueContainer.innerHTML = '<span class="ghosted">reference sequence not available</span>';
                                                }
                                            });
                           },
                           // end callback
                           function() {},
                           // error callback
                           function() {
                               valueContainer = dojo.byId(valueContainerID) || valueContainer;
                               valueContainer.innerHTML = '<span class="ghosted">reference sequence not available</span>';
                           }
                         );
                 } else {
                     valueContainer.innerHTML = '<span class="ghosted">reference sequence not available</span>';
                 }
             });
        }
    },

    _uniqID: function() {
        this._idCounter = this._idCounter || 0;
        return this._idCounter++;
    },

    _subfeaturesDetail: function( trackRenderer, subfeatures, container ) {
        var field_container = domConstruct.create('div', { className: 'field_container subfeatures' }, container );
        domConstruct.create( 'h2', { className: 'field subfeatures', innerHTML: 'Subfeatures' }, field_container );
        var subfeaturesContainer = domConstruct.create( 'div', { className: 'value subfeatures' }, field_container );
        var trackName = trackRenderer.get('widget').get('track').getCssClass();
        array.forEach( subfeatures || [], function( subfeature ) {
                           this.defaultFeatureDetail(
                               trackRenderer,
                               subfeature,
                               null,
                               domConstruct.create(
                                   'div', {
                                       className: 'detail'
                                           + ' feature-detail subfeature-detail'
                                           + ' feature-detail-'+trackName
                                           + ' subfeature-detail-'+trackName
                                   }, subfeaturesContainer )
                           );
                       },this);
    }

});
});