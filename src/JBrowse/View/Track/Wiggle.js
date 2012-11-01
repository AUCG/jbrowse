define( ['dojo/_base/declare',
         'dojo/on',
         'JBrowse/View/Track/Canvas',
         'JBrowse/View/Track/YScaleMixin',
         'JBrowse/View/Track/ExportMixin',
         'JBrowse/Util'
        ],
        function( declare, on, CanvasTrack, YScaleMixin, ExportMixin, Util ) {
var Wiggle = declare( CanvasTrack, {
    constructor: function( args ) {
        this.store = args.store;
        dojo.connect( this.store, 'loadSuccess', this, 'loadSuccess' );
        dojo.connect( this.store, 'loadFail',    this, 'loadFail' );
    }
});

/**
 * Mixin: JBrowse.View.Track.YScaleMixin.
 */
dojo.safeMixin( Wiggle.prototype, YScaleMixin );

/**
 * Mixin: JBrowse.View.Track.ExportMixin.
 */
dojo.safeMixin( Wiggle.prototype, ExportMixin );

/**
 * @lends JBrowse.View.Track.Wiggle.prototype
 */
Wiggle.extend({
    _defaultConfig: function() {
        return { maxExportSpan: 500000 };
    },

    load: function() {
        this.store.load();
    },

    loadSuccess: function(o,url) {
        this._calculateScaling();
        this.empty = this.store.empty || false;
        this.setLoaded();
    },

    loadFail: function() {
    },

    makeWiggleYScale: function() {
        if( ! this.scale )
            return;

        // bump minDisplayed to 0 if it is within 0.5% of it
        if( Math.abs( this.scale.min / this.scale.max ) < 0.005 )
            this.scale.min = 0;

        this.makeYScale({
            fixBounds: true,
            min: this.scale.min,
            max: this.scale.max
        });
        this.scale.min = this.ruler.scaler.bounds.lower;
        this.scale.max = this.ruler.scaler.bounds.upper;
        this.scale.range = this.scale.max - this.scale.min;
    },

    _calculateScaling: function() {
        // if either autoscale or scale is set to z_score, the other one should default to z_score
        if( this.config.autoscale == 'z_score' && ! this.config.scale
            || this.config.scale == 'z_score'  && !this.config.autoscale
          ) {
              this.config.scale = 'z_score';
              this.config.autoscale = 'z_score';
          }

        var z_score_bound = parseFloat( this.config.z_score_bound ) || 4;
        var s = this.getGlobalStats() || {};
        var min = 'min_score' in this.config ? parseFloat( this.config.min_score ) :
            (function() {
                 switch( this.config.autoscale ) {
                     case 'z_score':
                         return Math.max( -z_score_bound, (s.scoreMin-s.scoreMean) / s.scoreStdDev );
                     case 'global':
                         return s.scoreMin;;
                     case 'clipped_global':
                     default:
                         return Math.max( s.scoreMin, s.scoreMean - z_score_bound * s.scoreStdDev );
                 }
             }).call(this);
        var max = 'max_score' in this.config ? parseFloat( this.config.max_score ) :
            (function() {
                 switch( this.config.autoscale ) {
                     case 'z_score':
                         return Math.min( z_score_bound, (s.scoreMax-s.scoreMean) / s.scoreStdDev );
                     case 'global':
                         return s.scoreMax;
                     case 'clipped_global':
                     default:
                         return Math.min( s.scoreMax, s.scoreMean + z_score_bound * s.scoreStdDev );
                 }
             }).call(this);

        if( typeof max != 'number' || isNaN(max) ) {
            throw 'cannot display track '+this.name+', could not determine max_score.  Do you need to set max_score in its configuration?';
        }
        if( typeof min != 'number' || isNaN(min) ) {
            throw 'cannot display track '+this.name+', could not determine min_score.  Do you need to set min_score in its configuration?';
        }

        // if we have a log scale, need to take the log of the min and max
        if( this.config.scale == 'log' ) {
            max = Math.log(max);
            min = min ? Math.log(min) : 0;
        }

        var offset = parseFloat( this.config.data_offset ) || 0;
        var origin = (function() {
          if ( 'bicolor_pivot' in this.config ) {
            if ( this.config.bicolor_pivot == 'mean' ) {
              return s.scoreMean || 0;
            } else if ( this.config.bicolor_pivot == 'zero' ) {
              return 0;
            } else {
              return parseFloat( this.config.bicolor_pivot );
            }
          } else if ( this.config.scale == 'z_score' ) {
            return s.scoreMean || 0;
          } else if ( this.config.scale == 'log' ) {
            return 1;
          } else {
            return 0;
          }
        }).call(this);

        this.scale = {
            offset: offset,
            min: min + offset,
            max: max + offset,
            range: max - min,
            origin: origin
        };

        // make a func that converts wiggle values to Y coordinates on
        // the plot, depending on what kind of scale we are using
        this.scale.toY = function() {
            var scale = this.scale;
            switch( this.config.scale ) {
            case 'z_score':
                return function( canvasHeight, value ) {
                    with(scale)
                        return canvasHeight * (1-((value+offset-s.scoreMean)/s.scoreStdDev-min)/range);
                };
            case 'log':
                return function( canvasHeight, value ) {
                    with(scale)
                        return canvasHeight * (1-(Math.log(value+offset)-min)/range);
                };
            case 'linear':
            default:
                return function( canvasHeight, value ) {
                    with(scale)
                        return canvasHeight * (1-(value+offset-min)/range);
                };
            }
        }.call(this);

        return this.scale;
    },

    readWigData: function( scale, refSeq, leftBase, rightBase, callback ) {
        this.store.readWigData.apply( this.store, arguments );
    },

    getGlobalStats: function() {
        return this.store.getGlobalStats();
    },

    fillBlock: function( blockIndex,     block,
                         leftBlock,      rightBlock,
                         leftBase,       rightBase,
                         scale,          stripeWidth,
                         containerStart, containerEnd) {

        var blockWidth = rightBase - leftBase;
        this.heightUpdate( this.height, blockIndex );

        var canvasWidth  = Math.ceil(( rightBase - leftBase ) * scale);
        var canvasHeight = parseInt(( this.config.style || {}).height) || 100;
        this.height = canvasHeight;

        var posColor  = this.config.style.pos_color || '#00f';
        var negColor  = this.config.style.neg_color || '#f00';
        var clipColor = this.config.style.clip_marker_color;
        var disableClipMarkers = this.config.disable_clip_markers;

        this.readWigData( scale, this.refSeq.name, leftBase, rightBase+1, dojo.hitch(this,function( features ) {
                if(! this.yscale )
                    this.makeWiggleYScale();

                var c = dojo.create(
                    'canvas',
                    { height: canvasHeight,
                      width:  canvasWidth,
                      style: { cursor: 'default' },
                      innerHTML: 'Your web browser cannot display this type of track.'
                    },
                    block
                );
                c.startBase = leftBase;
                var context = c && c.getContext && c.getContext('2d');
                if( context && this.scale && this.scale.toY && features ) {
                        var toY = dojo.hitch( this, this.scale.toY, c.height );
                        var originY = toY( this.scale.origin );

                        //context.fillText(features.length+' spans', 10,10);
                        //console.log( 'filling '+leftBase+'-'+rightBase);
                        var pixelValues = new Array( c.width );
                        dojo.forEach(features, function(f) {
                            //console.log( f.get('start') +'-'+f.get('end')+':'+f.get('score') );
                            var score = f.get('score');
                            var rTop = toY( score );
                            if( rTop <= canvasHeight ) {
                                var rWidth = Math.ceil( ( f.get('end')   - f.get('start') ) * scale );
                                var rLeft  = Math.floor(( f.get('start') - leftBase       ) * scale );

                                // if rLeft is negative (off the left
                                // side of the canvas), clip off the
                                // (possibly large!) non-visible
                                // portion
                                if( rLeft < 0 ) {
                                    rWidth += rLeft;
                                    rLeft  = 0;
                                }
                                // also don't let rWidth get overly big
                                if( rWidth > canvasWidth ) {
                                    rWidth = canvasWidth;
                                }

                                this._updatePixelValues( pixelValues, rLeft, rWidth, f );
                                if( rTop <= originY ) {
                                    // bar goes upward
                                    context.fillStyle = posColor;
                                    context.fillRect( rLeft, rTop, rWidth, originY-rTop);
                                    if( !disableClipMarkers && rTop < 0 ) { // draw clip marker if necessary
                                        context.fillStyle = clipColor || negColor;
                                        context.fillRect( rLeft, 0, rWidth, 2 );
                                    }
                                }
                                else {
                                    // bar goes downward
                                    context.fillStyle = negColor;
                                    context.fillRect( rLeft, originY, rWidth, canvasHeight-rTop );
                                    if( !disableClipMarkers && rTop >= canvasHeight ) { // draw clip marker if necessary
                                        context.fillStyle = clipColor || posColor;
                                        context.fillRect( rLeft, canvasHeight-3, rWidth, 2 );
                                    }
                                }
                            }
                        }, this );

                        // draw the variance_band if requested
                        if( this.config.variance_band ) {
                            var stats = this.getGlobalStats();
                            if( stats && ('scoreMean' in stats) && ('scoreStdDev' in stats) ) {
                                var drawVarianceBand = function( plusminus, fill, label ) {
                                    context.fillStyle = fill;
                                    var varTop = toY( stats.scoreMean + plusminus );
                                    var varHeight = toY( stats.scoreMean - plusminus ) - varTop;
                                    varHeight = Math.max( 1, varHeight );
                                    context.fillRect( 0, varTop, c.width, varHeight );
                                    context.font = '12px sans-serif';
                                    if( plusminus > 0 ) {
                                        context.fillText( '+'+label, 2, varTop );
                                        context.fillText( '-'+label, 2, varTop+varHeight );
                                    }
                                    else {
                                        context.fillText( label, 2, varTop );
                                    }
                                };
                                drawVarianceBand( 2*stats.scoreStdDev, 'rgba(0,0,0,0.12)', '2σ' );
                                drawVarianceBand( stats.scoreStdDev, 'rgba(0,0,0,0.25)', '1σ' );
                                drawVarianceBand( 0, 'rgba(255,255,0,0.7)', 'mean' );
                            }
                        }

                        var scoreDisplay = dojo.create(
                            'div', {
                                className: 'wiggleValueDisplay',
                                style: {
                                    position: 'absolute',
                                    display: 'none',
                                    top: 0,
                                    left: 0,
                                    zIndex: 15
                                }
                            }, block );
                        var verticalLine = dojo.create( 'div', {
                                className: 'trackVerticalPositionIndicator',
                                style: {
                                    position: 'absolute',
                                    top: 0,
                                    display: 'none',
                                    cursor: 'default',
                                    left: '-2px',
                                    height: c.height+'px',
                                    width: '1px',
                                    borderWidth: '0',
                                    zIndex: 15
                                }
                        }, block);
                        var outTO;
                        on( c, 'mousemove', dojo.hitch(this,function(evt) {
                                if( outTO ) {
                                    window.clearTimeout( outTO );
                                    outTO = null;
                                }
                                var x = ( evt.offsetX || evt.layerX )-3;
                                verticalLine.style.display = 'block';
                                verticalLine.style.left = x+'px';

                                if( this._showPixelValue( scoreDisplay, pixelValues[x] ) ) {
                                    scoreDisplay.style.left = x+'px';
                                    scoreDisplay.style.display = 'block';
                                } else {
                                    scoreDisplay.style.display = 'none';
                                }
                        }));
                        on( c, 'mouseout', function(evt) {
                                outTO = window.setTimeout( function() {
                                    scoreDisplay.style.display = 'none';
                                    verticalLine.style.display = 'none';
                                }, 50 );
                        });
                        on( c, 'mousein', function(evt) {
                                    scoreDisplay.style.display = 'block';
                                    verticalLine.style.display = 'block';
                        });


                    this.heightUpdate( c.height, blockIndex );
                    c.className = 'canvas-track';
	            if (!(c.parentNode && c.parentNode.parentNode)) {
                        c.style.position = "absolute";
                        c.style.left = (100 * ((c.startBase - leftBase) / blockWidth)) + "%";
                        switch (this.config.align) {
                        case "top":
                            c.style.top = "0px";
                            break;
                        case "bottom":
                        default:
                            c.style.bottom = this.trackPadding + "px";
                            break;
                        }
	            }
                }
                else {
                    // can't draw the data
                    c.parentNode.removeChild(c);
                    var notsupported = dojo.create(
                        'div', {
                            className: 'error',
                            innerHTML: 'This track could not be displayed, possibly because your browser does not support it.  See browser error log for details.'
                        }, block );
                    this.heightUpdate( dojo.position(notsupported).h, blockIndex );
                }

            }));
    },

    _updatePixelValues: function( pixelValues, rLeft, rWidth, f ) {
        var iend = rLeft+rWidth;
        var score = f.get('score');
        for( var i = rLeft; i < iend; i++ ) {
            pixelValues[i] = i in pixelValues ? Math.max( pixelValues[i], score ) : score;
        }
    },
    _showPixelValue: function( scoreDisplay, score ) {
        if( typeof score == 'number' ) {
            // display the score with only 6
            // significant digits, avoiding
            // most confusion about the
            // approximative properties of
            // IEEE floating point numbers
            // parsed out of BigWig files
            scoreDisplay.innerHTML = parseFloat( score.toPrecision(6) );
            return true;
        } else {
            return false;
        }
    },

    updateStaticElements: function( coords ) {
        this.inherited( arguments );
        this.updateYScaleFromViewDimensions( coords );
    },

    _exportFormats: function() {
        return ['bedGraph','Wiggle', 'GFF3' ];
    }
});
return Wiggle;
});
