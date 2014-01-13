/**
 * Track view that displays the underlying reference sequence bases.
 */
define( [
            'dojo/_base/declare',
            'dojo/_base/lang',
            'dojo/_base/array',
            'dojo/dom-construct',
            'dojo/promise/all',
            'dojo/when',
            'dojo/dom-construct',

            'JBrowse/MediaTypes',
            '../Track',
            './_BlockBasedMixin',
            'JBrowse/Util',
            'JBrowse/Errors'
        ],
        function(
            declare,
            lang,
            array,
            dom,
            all,
            when,
            domConstruct,

            MediaTypes,
            TrackView,
            _BlockBasedMixin,
            Util,
            Errors
        ) {

return declare( [ TrackView, _BlockBasedMixin ],
{
    trackCSSClass: 'sequenceBases',

    animateBlock: function( block, blockNode, changeInfo ) {
        if( changeInfo.operation == 'mergeRight' ) {
            var dims = block.getDimensions();
            var w = dims.w;
            var factor = (w-changeInfo.deltaRight)/w;
            array.forEach( blockNode.children, function( node ) {
                node.style.width = factor*parseFloat(node.style.width)+'%';
                node.style.left  = factor*parseFloat(node.style.left||'0')+'%';
            });
            try {
                var rightBlock = changeInfo.mergeWith.block;
                var rightDims = rightBlock.getDimensions();
                var rightNode = this.blockStash[rightBlock.id()].node;
                var mergeTemp = dom.create('div', { className: 'renderingBlock mergeTemporary' }, blockNode );
                array.forEach( Array.prototype.slice.call( rightNode.children), function(node) {
                                   rightNode.removeChild( node );
                                   mergeTemp.appendChild( node );
                               });
                mergeTemp.style.left = 100*(rightDims.l-dims.l)/dims.w + '%';
                mergeTemp.style.width = 100*rightDims.w/dims.w+'%';
            } catch(e) {
                console.error(e.stack);
            }
        }
        else if( changeInfo.operation == 'splitLeft' ) {
            if( blockNode.firstChild ) {
                var w = block.getDimensions().w;
                blockNode.firstChild.style.width = 100*(w-changeInfo.deltaRight)/w+'%';
            }
        }

        this.get('renderer').animateBlock( block, blockNode, changeInfo );

        // if we are not just moving or destroying it, we need to
        // redraw it, either now or later
        if( changeInfo.operation != 'move' && changeInfo.operation != 'destroy' ) {
            if( this.get('renderer').animatableFill() ) {
                return this.fillBlock( block, blockNode, changeInfo );
            }
            else {
                // if we need to fill the block, but we're animating,
                // schedule it to be filled later, at the next
                // non-animating change
                if( ! this.blockStash[ block.id() ].fillLater ) {
                    this.blockStash[ block.id() ].fillLater = changeInfo;
                    return this.fillBlockWithLoadingMessage( block, blockNode, changeInfo );
                }
            }
        }

        return undefined;
    },

    blockChange: function( blockNode, changeInfo, block ) {
        this.inherited(arguments);
        this.get('renderer').blockChange( blockNode, changeInfo, block );
    },

    heightUpdate: function( h, block ) {
        if( block ) {
            //console.log('block %d height %d', block.id(), h );
            if(! this.blockStash[block.id()] )
                debugger;

            this.blockStash[block.id()].requestedHeight = h;

            var maxHeight = 0;
            for( var id in this.blockStash ) {
                var blockHeight = this.blockStash[id].requestedHeight;
                if( blockHeight > maxHeight )
                    maxHeight = blockHeight;
            }
            this.inherited( arguments, [ maxHeight ] );
        }
        else {
            this.inherited( arguments );
        }
    },

    renderLoadingMessage: function( node ) {
        var loadingIndicator;
        dom.create(
            'span', {className: 'text', innerHTML: 'Loading' },
            loadingIndicator = dom.create( 'div', { className: 'loading' }, node )
        );
        return loadingIndicator;
        // node.innerHTML = this.loadingMessage;
        // return node.firstChild;
    },

    fillBlockWithLoadingMessage: function( block, blockNode, changeInfo ) {
        var indicator = this.renderLoadingMessage( blockNode );
        return indicator;
    },

    fillBlock:function( block, blockNode, changeInfo ) {
        var thisB = this;
        if( ! this.domNode )
            debugger;
        var loadingIndicator;
        // var loadingTimeout = this.ownPromise (
        //     Util.wait({ duration: 300, cancelOK: true })
        //         // .then( function() {
        //         //            loadingIndicator = thisB.fillBlockWithLoadingMessage( block, blockNode, changeInfo );
        //         //        }, Util.cancelOK )
        // );

        //console.log( 'fill '+block.id() );
        return this.ownPromise( this.blockStash[block.id()].fillInProgress =
            when( this.get('renderer').fillBlock( block, blockNode, changeInfo )))
                .then( function(v) {
                           //loadingTimeout.cancel();
                           if( loadingIndicator )
                               dom.destroy( loadingIndicator );
                           return v;
                       },
                       function(error) {
                           //loadingTimeout.cancel();
                           if( !( error instanceof Errors.Cancel )) {
                               console.error( error.stack || ''+error );
                               blockNode.innerHTML = '<div class="error">'+(error.stack || ''+error)+'</div>';
                           }
                       }
                     );
    }

});
});
