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
           DOMBlock,
           Util
       ) {

return declare( _WidgetBase, {

baseClass: 'viewScale',

constructor: function(args) {
},

_setGenomeViewAttr: function( genomeView ) {
    var thisB = this;

    genomeView.watch( 'projection',
        function( name, oldProjection, newProjection ) {
            thisB._makeBlockList( newProjection );
        });
},

_makeBlockList: function( projection ) {
    var thisB = this;
    if( this.blockList )
        this.blockList.destroy();
    this.blockList = new BlockList(
        {
            projection: projection,
            viewportNode: this.domNode,
            newBlock: function( args ) {
                args.parentNode = thisB.domNode;
                args.changeCallbacks = {
                    move: function() {}, //< don't need to do anything when blocks move
                    "default": function( changeInfo ) {
                        if( changeInfo.operation == 'destroy' )
                            return;
                        thisB.fillBlock( this, projection );
                    }
                };
                var block = new DOMBlock( args );
                thisB.fillBlock( block, projection );
                return block;
            }
        });
},

fillBlock: function( block, projection, isAnimating ) {
    //console.log('fill');
    var projectionBlocks = projection.getBlocksForRange( block.left, block.right );
    var html = [];
    array.forEach( projectionBlocks, function( projectionBlock ) {
        var aRange = projectionBlock.getValidRangeA();
        var scale = projectionBlock.getScale();

        var minBase = projectionBlock.projectPoint( Math.max( aRange.l, block.left ) );
        var maxBase = projectionBlock.projectPoint( Math.min( aRange.r, block.right ));
        if( minBase === null || maxBase === null )
            return;

        if( scale < 0 ) { // swap if negative
            var tmp = minBase;
            minBase = maxBase;
            maxBase = tmp;
        }

        if( scale > 0 && block.left <= aRange.l || scale < 0 && block.right >= aRange.r )
            minBase += Math.abs( 10*scale );
        if( scale > 0 && block.right >= aRange.r || scale < 0 && block.left <= aRange.l )
            maxBase -= Math.abs( 10*scale );

        var labelPitch = this._choosePitch( scale, 60 );
        for( var b = Math.ceil( minBase / labelPitch )*labelPitch; b < maxBase; b += labelPitch ) {
            var label = Util.humanReadableNumber(b);
            var leftpx = projectionBlock.reverseProjectPoint(b)-block.left;
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