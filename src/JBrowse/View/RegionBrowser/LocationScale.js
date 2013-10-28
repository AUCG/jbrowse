define([
           'dojo/_base/declare',
           'dojo/_base/lang',
           'dojo/_base/array',
           'dojo/dom-geometry',
           'dojo/dom-construct',

	   "dijit/_WidgetBase",

           'JBrowse/View/Track/BlockList',
           'JBrowse/View/Track/BlockList/BlockWithDOM',
           'JBrowse/Util'

       ], function(
           declare,
           lang,
           array,
           domGeom,
           domConstruct,

           _WidgetBase,

           BlockList,
           Block,
           Util
       ) {

return declare( _WidgetBase, {

baseClass: 'viewScale',

constructor: function(args) {
},

_setGenomeViewAttr: function( genomeView ) {
    var thisB = this;

    genomeView.watch(
        'projection',
        function( name, oldProjection, newProjection ) {
            if( thisB.blockList )
                thisB.blockList.destroy();
            thisB.blockList = new BlockList(
                {
                    projection: newProjection,
                    viewportNode: thisB.domNode,
                    newBlock: function( args ) {
                        args.parentNode = thisB.domNode;
                        args.callbacks = {
                            // callback when block changes
                            // screen coordinates, but not size
                            // but is guaranteed to correspond
                            // to the same genomic region as
                            // before
                            move: function( deltaLeft, deltaRight, projectionChange ) {
                                // don't need to do anything when blocks just move
                            },

                            // callback when block changes
                            // screen coordinates and/or size,
                            // and is *not* guaranteed to
                            // correspond to the same genomic
                            // region
                            "default": function( changeInfo ) {
                                if( changeInfo.operation == 'destroy' )
                                    return;

                                this.filled = false;
                                thisB.fillBlock( this, newProjection );
                                this.filled = true;
                            }
                        };
                        var block = new Block( args );
                        thisB.fillBlock( block, newProjection );
                        return block;
                    }
                });
        });

    if( genomeView.get('projection') )
        this._update( genomeView.get('projection') );
},

fillBlock: function( block, projection, isAnimating ) {
    //console.log('fill');
    var projectionBlocks = projection.getBlocksForRange( block.left, block.right );
    var html = [];
    array.forEach( projectionBlocks, function( projectionBlock, i ) {
        var aRange = projectionBlock.getValidRangeA();
        var leftBase  = projectionBlock.projectPoint( Math.max( aRange.l, block.left ) );
        var rightBase = projectionBlock.projectPoint( Math.min( aRange.r, block.right ));
        if( leftBase === null || rightBase === null )
            return;

        if( leftBase > rightBase ) { // swap if negative
            var tmp = leftBase;
            leftBase = rightBase;
            rightBase = tmp;
        }
        var labelPitch = this._choosePitch( projectionBlock.getScale(), 60 );
        var prevlabel;
        for( var b = Math.ceil( (leftBase+0.001) / labelPitch )*labelPitch; b <= rightBase; b += labelPitch ) {
            var label = Util.humanReadableNumber(b);
            var leftpx = projectionBlock.reverseProjectPoint(b)-block.left;
            if( leftpx < 0 || leftpx > block.width()+1 )
                debugger;
            if( label != prevlabel ) //< prevent runs of the same label, which can happen for big numbers
                html.push(
                    '<div class="posLabel" style="left: ',
                    leftpx,
                    'px" title="',
                    Util.commifyNumber(b),
                    '"><span style="left: -',
                    (label.length*3),
                    'px">'
                    ,label,
                    '</span></div>'
                );
            prevlabel = label;
        }
    },this);

    block.domNode.innerHTML = html.join('');
},

_choosePitch: function( scale, minPxSpacing ) {
    var minPitch = minPxSpacing * Math.abs( scale );
    var magnitude = parseInt(
         new Number(minPitch).toExponential().split(/e/i)[1]
    );

    var pitch = Math.pow( 10, magnitude );
    while( pitch < minPitch ) {
        pitch *= 2;
        if( pitch >= minPitch )
            return pitch;
        pitch *= 2.5;
    }

    return pitch;
}

});
});