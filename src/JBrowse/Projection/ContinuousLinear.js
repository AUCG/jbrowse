define([
           'dojo/_base/declare',
           'dojo/Deferred',

           '../Projection',
           'JBrowse/Util'
       ],
       function(
           declare,
           Deferred,

           Projection,
           Util
       ) {

var Continuous = declare( 'JBrowse.Projection.ContinuousLinear', Projection,  {

  constructor: function( args ) {
      if( args.from && args.to ) {
          var scale = ( args.from.length || (args.from.end-args.from.start) ) / ( args.to.length || (args.to.end-args.to.start) );
          this.scale = scale;
          this.bOffset = args.to.start - args.from.start/scale;
      }
      else {
          this.bOffset = args.offset;
          this.scale  = args.scale;
      }

      this.aStart = args.start || -Infinity;
      this.aEnd   = args.end   || Infinity;

      // delete the cached reverse of ourselves when we change
      var thisB = this;
      this.watch( function() { delete thisB._cachedReverse; } );
  },

  projectPoint: function( a ) {
      if( a > this.aEnd )
          return null;
      if( a < this.aStart )
          return null;
      return a * this.scale + this.bOffset;
  },

  projectRange: function( a1, a2 ) {
      if( a2 < this.aStart || a1 > this.aEnd )
          return null;

      var b1 = this.projectPoint( a1 );
      var b2 = this.projectPoint( a2 );
      return b1 <= b2 ? [b1,b2] : [b2,b1];
  },

  getBlocksForRange: function( a1, a2 ) {
      if( a2 < this.aStart || a1 > this.aEnd )
          return null;
      return [ this ];
  },

  reverse: function() {
      // cache the reverse of our projection
      return this._cachedReverse || ( this._cachedReverse = function() {
          return new Continuous(
              {
                  aName: this.bName,
                  bName: this.aName,
                  offset: -this.bOffset/this.scale,
                  scale:  1/this.scale,
                  start:  this.projectPoint( this.aStart ),
                  end:    this.projectPoint( this.aEnd )
              });
      }.call(this));
  },

  offset: function( deltaA, animationMilliseconds ) {
      if( ! deltaA ) return;
      var newOffset = this.bOffset + deltaA * this.scale;
      this[ animationMilliseconds ? 'animateTo' : 'setTo' ]( undefined, newOffset, animationMilliseconds );
  },

  // scale the projection in A by the given factor, and offset in A by
  // the given offset.
  scaleOffset: function( factor, deltaA ) {
      this.scale *= factor;
      this.offset( deltaA );
      this._notifyChangedAll({ scale: this.scale, offset: this.bOffset });
  },

  toString: function() {
      return this.scale+','+this.bOffset;
  },

  setTo: function( endScale, endOffset ) {
      if( endScale !== undefined )
          this.scale   = endScale;
      if( endOffset !== undefined )
          this.bOffset = endOffset;
      this._notifyChangedAll({ scale: this.scale, offset: this.bOffset });
  },

  // return a Deferred that has progress events each time the
  // projection is updated to an intermediate configuration, and
  // resolves when the projection finishes animating
  animateTo: function( endScale, endOffset, milliseconds ) {
      if( endScale === undefined )
          endScale = this.scale;
      if( endOffset === undefined )
          endOffset = this.bOffset;

      //console.log( 'animating from '+this+' to '+endScale+','+endOffset);
      if( this._currentAnimation )
          this._currentAnimation.cancel('new animation requested');

      var thisB = this;
      var startTime   = new Date().getTime();
      var startScale  = this.scale;
      var startOffset = this.bOffset;

      var canceled = false;
      var a = this._currentAnimation = new Deferred( function() { canceled = true; });
      a.promise.always( function() {
                            if( thisB._currentAnimation === a )
                                delete thisB._currentAnimation;
                        });

      function ease( elapsedTime, totalTime ) {
          // linear
          //return elapsedTime/totalTime;

          // sinusoidal
          return Math.sin( elapsedTime/totalTime*3.14159/2 )+0.04;
      }

      Util.requestAnimationFrame(
          function animate() {
              if( canceled ) return;

              var proportionDone = ease( (new Date().getTime() - startTime),  milliseconds );

              if( proportionDone >= 1 ) {
                  thisB.setTo( endScale, endOffset );
                  a.resolve();
              } else {
                  thisB.setTo(
                      startScale  + (endScale-startScale  )*proportionDone,
                      startOffset + (endOffset-startOffset)*proportionDone
                  );
                  a.progress( proportionDone );
                  Util.requestAnimationFrame( animate );
              }
          });

      return this._currentAnimation;
  }

});
return Continuous;
});