define([
           'dojo/_base/declare',
           'dojo/on',
           'dojo/dom-construct',
           'dojo/Deferred',
           'JBrowse/View/Track/BlockBased',
           'JBrowse/View/Track/HTMLFeatures',
           'JBrowse/Store/SeqFeature/Combination/TreeNode',
            'dojo/dnd/move',
           'dojo/dnd/Source',
           'dojo/dnd/Manager',
           'JBrowse/Util'],
       function(
           declare,
           on,
           dom,
           Deferred,
           BlockBased,
           HTMLFeaturesTrack,
           TreeNode,
           dndMove,
           dndSource,
           dndManager,
           Util
       ) {
return declare(BlockBased,
 /**
  * @lends JBrowse.View.Track.Combination.prototype
  */
{

    /**
     * 
     * 
     * @constructs
     */

    constructor: function( args ) {
        this.loaded = true;
        this.divClass = args.divClass || "combination";

        this.tracks = [];
        this.defaultOp = "AND";
        this.opTree = new TreeNode({ Value: this.defaultOp });
        this.currentDndSource = undefined;
        this.sourceWasCopyOnly = undefined;

        // This is used to avoid creating a feedback loop in the height-updating process.
        this.onlyRefreshOuter = false;
        // Height of the top and bottom divs (when there is an inner track)
        this.topHeight = 20;
        this.bottomHeight = 20;
        this.heightInner = 0;

        // Height of the track (when there is no inner track)
        this.heightNoInner = 50;

        this.height = args.height || this.heightNoInner;

        this.keyToStore = {};
        this.storeToKey = {};

        this.innerTrack = undefined;
        this.innerDiv = undefined;
        this.counter = 0;
    },

    setViewInfo: function(genomeView, heightUpdate, numBlocks,
                         trackDiv,
                         widthPct, widthPx, scale) {
        this.inherited( arguments );
        this.scale = scale;

        this.dnd = new dndSource( this.div,
        {
          accept: ["track"], //Accepts only tracks
          withHandles: true,
          creator: dojo.hitch( this, function( trackConfig, hint ) {
              return {
                  data: trackConfig,
                  type: ["track"],
                  node: hint == 'avatar'
                                 ? dojo.create('div', { innerHTML: "Inner Track", className: 'track-label dragging' })
                                 : this.addTrack(trackConfig)
              };
          })
        });

        this._attachDndEvents();
    },

    _attachDndEvents: function() {
        var thisB = this;
        on(thisB.dnd, "DndStart", function(source, nodes, copy) {
                                                if(source == thisB.dnd && nodes[0] && thisB.innerTrack) {
                                                  source.getItem(nodes[0].id).data = thisB.innerTrack.config;
                                                  source.getItem(nodes[0].id).data.label = "combination_inner_track" + thisB.browser.innerTrackCount;
                                                  thisB.onlyRefreshOuter = true;
                                                }
                                                thisB.currentDndSource = source;
                                                thisB.sourceWasCopyOnly = source.copyOnly;
                                            });
        on(thisB.dnd, "DraggingOver", function() {
                                                
                                                if(thisB.currentDndSource) {
                                                  thisB.currentDndSource.copyOnly = true;
                                                } 
                                            });
        var allCopyEndingEvents = ["DraggingOut", "DndDrop", "DndCancel"];
                
        for(var eventName in allCopyEndingEvents)
          on(thisB.dnd, allCopyEndingEvents[eventName], function() {
                                                if(thisB.currentDndSource) {
                                                  thisB.currentDndSource.copyOnly = thisB.sourceWasCopyOnly;
                                                }
                                            });
        on(thisB.dnd, "DndDrop", function(source, nodes, copy, target) {
          if(source == thisB.dnd && nodes[0]) {
            thisB.browser.innerTrackCount++;
            thisB.onlyRefreshOuter = false;
          }
          if(!copy && nodes[0] && source == thisB.dnd && target != thisB.dnd) {
            thisB.reinitialize();
            thisB.refresh();
          }
        });
        on(thisB.dnd, "DndCancel", function() {
            thisB.onlyRefreshOuter = false;
        });
        on(thisB.dnd, "OutEvent", function() {
            dndManager.manager().overSource(thisB.genomeView.trackDndWidget);
        });
    },

    reinitialize: function() {
      this.innerDiv = undefined;
      this.innerTrack = undefined;
      this.store = undefined;
      this.opTree = undefined;
      this.storeToKey = {};
      this.keyToStore = {};
    },

    addTrack: function(trackConfig) {
      var thisB = this;
      // There's probably a better way to store this data.  We'll do it this way since it's easily bidirectional (for read/write).
      thisB.storeToKey[trackConfig.store] = trackConfig.key;
      thisB.keyToStore[trackConfig.key] = trackConfig.store;

      if(!this.innerDiv) {
        this.innerDiv = document.createElement("div");
        this.innerDiv.className = "track";
        this.innerDiv.id = this.name + "_innerDiv";
        this.innerDiv.style.top = this.topHeight + "px"; //Alter this.
        //this.div.appendChild(this.innerDiv);
      } else { // Otherwise we'll have to remove whatever track is currently in the div
        thisB.innerTrack.clear();
        thisB.innerTrack.destroy();

        while(thisB.innerDiv.firstChild) { // Use dojo.empty instead?
          thisB.innerDiv.removeChild(thisB.innerDiv.firstChild);
        }
        
        thisB.innerDiv.parentNode.removeChild(thisB.innerDiv);
      }

      thisB._addTrackStore(trackConfig.store);
      /*      
      var nothing = document.createTextNode("");
      return nothing;
      */
      return thisB.innerDiv;
    },

    treeIterate: function(tree) {
      if(!tree || tree === undefined){ return "NULL";}
      if(tree.isLeaf()){
        return tree.get().name ? (this.storeToKey[tree.get().name] ? this.storeToKey[tree.get().name] : tree.get().name)
         : tree.get();
      }
      return "( " + this.treeIterate(tree.left()) +" "+ tree.get() +" " + this.treeIterate(tree.right()) +" )";
    },

    _addTrackStore: function(storeName) {
      var thisB = this;
      var haveStore = (function() {
        var d = new Deferred();
        thisB.browser.getStore(storeName, function(store) {
          if(store) {
            var storeNode = new TreeNode({Value: store});
            if(!thisB.opTree) { thisB.opTree = new TreeNode({Value: thisB.defaultOp});}
            if(!(thisB.opTree.add( storeNode ) ) ) {
              var opNode = new TreeNode({Value: thisB.defaultOp});
              opNode.add(thisB.opTree);
              opNode.add(storeNode);
              thisB.opTree = opNode;  
            }
            d.resolve(store,true);
          } else {
            d.reject("store " + storeName + " not found", true);
          }
        });
        return d.promise;
      })();
      haveStore.then(function(store){
        thisB._createCombinationStore();
      });
    },


    _createCombinationStore: function() {
      var d = new Deferred();
      var thisB = this;
      if(thisB.store) {
        d.resolve(true);
      } else {
        var storeConf = {
            browser: thisB.browser,
            refSeq: thisB.browser.refSeq,
            type: 'JBrowse/Store/SeqFeature/Combination',
            op: thisB.defaultOp,
          };
        var storeName = thisB.browser._addStoreConfig(undefined, storeConf);
        storeConf.name = storeName;
        thisB.browser.getStore(storeName, function(store) {
          thisB.store = store;
          d.resolve(true);
        });
      }
      d.promise.then(function(){ thisB._renderInnerTrack(); });
    },

    _renderInnerTrack: function() {
      var thisB = this;
      if(thisB.store) {
        thisB.innerTrack = new HTMLFeaturesTrack({
            config: thisB._innerTrackConfig(),
            browser: thisB.browser,
            refSeq: thisB.refSeq,
            store: thisB.store,
            trackPadding: 0
        });

        
        var innerHeightUpdate = function(height) {
          thisB.heightInner = height;
          thisB.height = thisB.topHeight + height + thisB.bottomHeight;
          thisB.onlyRefreshOuter = true;
          thisB.refresh();
          thisB.onlyRefreshOuter = false;

          thisB.heightUpdate(thisB.height);
          thisB.div.style.height = thisB.height + "px";
        }

        thisB.innerTrack.setViewInfo (thisB.genomeView, innerHeightUpdate,
            thisB.numBlocks, thisB.innerDiv, thisB.widthPct, thisB.widthPx, thisB.scale);

        thisB._redefineCloseButton();

        thisB.refresh();

      }

    },

    _redefineCloseButton: function() {
        var closeButton = this.innerTrack.label.childNodes[0];
        if(closeButton.className == "track-close-button") {
          this.innerTrack.label.removeChild(closeButton);
          var closeButton = dojo.create('div',{
                                                className: 'track-close-button'
                                              },this.innerTrack.label, "first");

          this.innerTrack.own( on( closeButton, 'click', dojo.hitch(this,function(evt){
                this.browser.view.suppressDoubleClick( 100 );
                this.div.removeChild(this.innerDiv);
                this.reinitialize();
                this.refresh();
                evt.stopPropagation();
          })));

        }
    },

    _innerTrackConfig: function() {
      return {
                  store: this.store.name,
                  feature: ["match"],
                  key: "Inner Track",
                  label: this.name + "_inner",
                  metadata: {Description: "This track was created from a combination track."},
                  type: "JBrowse/View/Track/HTMLFeatures"
              };
    },

    refresh: function(track) {
      //console.log(this.name + " refresh")
      var thisB = this;
      if(!track) track = thisB;
      if(this.store && !this.onlyRefreshOuter) this.store.reload(thisB.opTree);
      if(this.range) {
        track.clear();
        track.showRange(thisB.range.f, thisB.range.l, thisB.range.st, thisB.range.b,
          thisB.range.sc, thisB.range.cs, thisB.range.ce);
      }
    },

    showRange: function(first, last, startBase, bpPerBlock, scale,
                        containerStart, containerEnd) {
      //console.log(this.name + " sr " + this.dnd.getAllNodes().length);
      this.range = {f: first, l: last, st: startBase, 
                    b: bpPerBlock, sc: scale, 
                    cs: containerStart, ce: containerEnd};
      if(this.innerTrack && !this.onlyRefreshOuter) {
          this.innerTrack.clear();
          this.innerTrack.showRange(first, last, startBase, bpPerBlock, scale, containerStart, containerEnd);
        }
      //console.log("sr 2");
      this.inherited(arguments);
      this.height = (this.innerTrack ? (this.topHeight + this.heightInner + this.bottomHeight) : this.heightNoInner);
      this.heightUpdate(this.height);
      this.div.style.height = this.height + "px";
      //console.log("sr 3");
    },

    moveBlocks: function(delta) {
        this.inherited(arguments);
        if(this.innerTrack) this.innerTrack.moveBlocks(delta);
    },

    fillBlock: function( args ) {
        var blockIndex = args.blockIndex;
        var block = args.block;
        var leftBase = args.leftBase;

        var text = "Add tracks here";
        if(this.innerTrack) {
          var topDiv = document.createElement("div");
          topDiv.className = "combination";
          topDiv.style.height = this.topHeight + "px";
          topDiv.appendChild( document.createTextNode( text ) );
          block.domNode.appendChild( topDiv );

          var bottomDiv = document.createElement("div");
          bottomDiv.className = "combination";
          bottomDiv.style.height = this.bottomHeight + "px";
          bottomDiv.style.top = (this.topHeight + this.heightInner) + "px";
          bottomDiv.appendChild( document.createTextNode( text ) );
          block.domNode.appendChild( bottomDiv );
        } else {
          var textDiv = document.createElement("div");
          textDiv.className = "combination";
          var text = "Add tracks here";
          textDiv.style.height = this.heightNoInner + "px";
          textDiv.appendChild( document.createTextNode( text ) );  
          block.domNode.appendChild( textDiv );
        }

        var highlight = this.browser.getHighlight();
        if( highlight && highlight.ref == this.refSeq.name )
            this.renderRegionHighlight( args, highlight );

        this.heightUpdate( this.height, blockIndex);
        this.div.style.height = this.height + "px";
        args.finishCallback();
    },

    endZoom: function(destScale, destBlockBases) {
        this.clear(); // Necessary?
        if(this.innerTrack) this.innerTrack.endZoom();
    },

    msgLoop: function(list) {
      var msg = "";
      for(var item in list) msg = msg + " " + item +": " + list[item];
      alert(msg);
    },

    _trackMenuOptions: function() {
      var o = this.inherited(arguments);
      var combTrack = this;

      var allowedOps = ["AND", "OR", "XOR", "MINUS"];
      var menuItems = allowedOps.map(
                        function(op) {
                          return {
                            label: op,
                            title: "change operation of last track to " + op,
                            action: function() {
                              if(combTrack.opTree) {
                                combTrack.opTree.set(op);
                                combTrack.refresh();
                              }
                            }
                          }
                        });


      o.push.apply(
        o,
        [
          { type: 'dijit/MenuSeparator' },
          { label: 'Edit formula',
            title: 'change the formula specifying this combination track',
            action: function() {
                        if(combTrack.opTree) alert(combTrack.treeIterate(combTrack.opTree));
                        else alert("No operation formula defined");
                    }
          },
          { children: menuItems,
            label: "Change last operation",
            title: "change the operation applied to the last track added"
          }
        ]);

      return o;
    }
    
});
});