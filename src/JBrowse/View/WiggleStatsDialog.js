define( [
            'dojo/_base/declare',
            'dojo/_base/array',
            'dojo/aspect',
            'dijit/focus',
            'dijit/form/Button',
            'dijit/form/RadioButton',
            'dijit/form/MultiSelect',
            'dijit/form/TextBox',
            'dijit/form/FilteringSelect',
            'dijit/Dialog',
            'dojo/dom-construct',
            'dojo/dom-style',
            'dojo/_base/window',
            'dojo/Deferred',
            './MaskDialog/settingViewer',
            'dojo/on',
            'dojo/store/Memory'
        ],
        function( declare,
                  array,
                  aspect,
                  dijitFocus,
                  Button,
                  RadioButton,
                  MultiSelect,
                  TextBox,
                  FilteringSelect,
                  Dialog,
                  dom,
                  domStyle,
                  window,
                  Deferred,
                  settingViewer,
                  on,
                  memory ) {

return declare( null, {

    // DOES NOT WORK YET!... probably.

    constructor: function( args ) {
        this.browser = args.browser;
        this.browserSupports = {
            dnd: 'draggable' in document.createElement('span')
        };
        this.supportedTracks = ['JBrowse/View/Track/Wiggle/XYFunction',
                                'JBrowse/View/Track/Wiggle/Density',
                                'JBrowse/View/Track/Wiggle/XYPlot'];
        this.trackNames = [];
        for (var ID in args.browser.trackConfigsByName ) {
            if ( args.browser.trackConfigsByName.hasOwnProperty( ID ) ) {
                this.trackNames.push(args.browser.trackConfigsByName[ID].label);;
            }
        }
    },

    show: function( args ) {
        var dialog = this.dialog = new Dialog(
            { title: "New masking track", className: 'maskDialog' }
            );
        var contentContainer = dom.create( 'div', { className: 'contentContainer'});
        dialog.containerNode.parentNode.appendChild(contentContainer);
        dojo.destroy(dialog.containerNode)

        var actionBar         = this._makeActionBar( args.openCallback );
        var displaySelector   = this._makeStoreSelector({ title: 'Display', filter: true });
        var nameField         = this._makeNameField( "type desired track name here" );

        on( displaySelector.domNode, 'change', dojo.hitch(this, function ( e ) {
            // disable the "create track" button if there is no display data available..
            actionBar.createTrackButton.set('disabled', !(dojo.query('option', displaySelector.domNode).length > 0) );
        }));

        this.storeFetch = { data   : { display: displaySelector.sel },
                            name   : nameField,
                            getName: dojo.hitch(this, function() {
                                    var name = this.storeFetch.name.get('value') || ' ';
                                    if ( !(this.trackNames.indexOf(name) > -1) ) {
                                        return [name]
                                    }
                                    var counter = 0;
                                    while ( this.trackNames.indexOf(name+counter) > -1 ) {
                                        counter++;
                                    }
                                    return [name,name+counter];

                                }),
                            displayTypes: dojo.hitch(this.storeFetch, function(d) {
                                            var tracks = this.data.display.get('value')[0]
                                            ? this.data.display.get('value').map(
                                            function(arg){return arg.split(',');})
                                            : undefined;
                                            if ( !tracks ) {
                                                console.error('No display data chosen');
                                                thisB.dialog.hide();
                                                return;
                                            }
                                            tracks = tracks.reduce( function(a,b){ 
                                                                        if (!(a.indexOf(b[1]) > -1)) {
                                                                            a.push(b[1]);}
                                                                        return a
                                                                        }, [] );
                                            if ( tracks.length == 1 ) {
                                                d.resolve(tracks[0], true);
                                            }
                                            else {
                                                console.error('multiple track types selected for display data (should not be possible).');
                                            }
                                }),
                            fetch  : dojo.hitch(this.storeFetch, function() {
                                    var storeLists = { display: this.data.display.get('value')[0]
                                                                ? this.data.display.get('value').map(
                                                                    function(arg){return arg.split(',')[0];})
                                                                : undefined };
                                    return storeLists;
                                })
                          };


        var div = function( attr, children ) {
            var d = dom.create('div', attr );
            array.forEach( children, dojo.hitch( d, 'appendChild' ));
            return d;
        };

        var textCont = dom.create( 'div', { className: 'textFieldContainer'});
        textCont.appendChild(nameField.domNode);

        var content = [
                        dom.create( 'div', { className: 'instructions',
                                             innerHTML: 'instructions will go here!' } ),
                            div( { className: 'storeSelectors' },
                             [ displaySelector.domNode ]
                            ),
                        textCont,
                        actionBar.domNode
                      ];

        for ( var node in content ) {
            if ( content.hasOwnProperty ) {
                contentContainer.appendChild(content[node]);
            }
        }
        dialog.show()

        // destroy the dialogue after it has been hidden
        aspect.after( dialog, 'hide', dojo.hitch( this, function() {
                              dijitFocus.curNode && dijitFocus.curNode.blur();
                              setTimeout( function() { dialog.destroyRecursive(); }, 500 );
                      }));
    },

    _makeActionBar: function( openCallback ) {
        var thisB = this;
        // Adapted from the file dialogue.
        var actionBar = dom.create( 'div', { className: 'dijitDialogPaneActionBar' });

        var disChoices = thisB.trackDispositionChoice = [
            new RadioButton({ id: 'openImmediately',
                              value: 'openImmediately',
                              name: 'disposition',
                              checked: true
                            }),
            new RadioButton({ id: 'addToTrackList',
                              value: 'addToTrackList',
                              name: 'disposition'
                            })
        ];

        var aux1 = dom.create( 'div', {className:'openImmediatelyButton'}, actionBar );
        disChoices[0].placeAt(aux1);
        dom.create('label', { for: 'openImmediately', innerHTML: 'Open immediately' }, aux1 );
        var aux2 = dom.create( 'div', {className:'addToTrackListButton'}, actionBar );
        disChoices[1].placeAt(aux2);
        dom.create('label', { for: 'addToTrackList', innerHTML: 'Add to tracks' }, aux2 );


        new Button({ iconClass: 'dijitIconDelete', label: 'Cancel',
                     onClick: function() { thisB.dialog.hide(); }
                   })
            .placeAt( actionBar );
        var createTrack = new Button({ label: 'Create track',
                     disabled: true,
                     onClick: dojo.hitch( thisB, function() {
                                // first, select everything in the multiselects.
                                for ( var key in thisB.storeFetch.data ) {
                                    if ( thisB.storeFetch.data.hasOwnProperty(key) ) {
                                        dojo.query('option', thisB.storeFetch.data[key].domNode)
                                           .forEach(function(node, index, nodelist){
                                                node.selected = true;
                                            });
                                    }
                                }
                                d = new Deferred();
                                thisB.storeFetch.displayTypes(d);
                                dojo.when(d, function( arg ){
                                    var name = thisB.storeFetch.getName();
                                    openCallback({
                                        trackConf: { key: name[0],
                                                     label: name[1]||name[0],
                                                     type:  'JBrowse/View/Track/Statistics',
                                                     store: { name: name[1]||name[0],
                                                              browser: thisB.browser,
                                                              refSeq:  thisB.browser.refSeq,
                                                              type: 'JBrowse/Store/SeqFeature/WiggleStatistics',
                                                              storeNames: thisB.storeFetch.fetch()
                                                            }
                                                    },
                                        trackDisposition: thisB.trackDispositionChoice[0].checked ? thisB.trackDispositionChoice[0].value :
                                                          thisB.trackDispositionChoice[1].checked ? thisB.trackDispositionChoice[1].value :
                                                          undefined
                                    });
                                })
                                thisB.dialog.hide();
                            })
                    })
            .placeAt( actionBar );

        return { domNode: actionBar, createTrackButton: createTrack };
    },

    _makeStoreSelector: function( args ) {
        var selectorTitle = args.title;

        var container = dom.create( 'div', { className: 'selectorContainer'} )
        var title = dom.create( 'div', { className: 'selectorTitle', innerHTML: selectorTitle } );
        var selector = new MultiSelect();
        selector.containerNode.className = 'storeSelections';
        var tracks = {};
        for ( var ID in this.browser.trackConfigsByName ) {
            if ( this.browser.trackConfigsByName.hasOwnProperty(ID) ) {
                var tmp = this.browser.trackConfigsByName;
                tracks[ tmp[ID].key || tmp[ID].label ] = { type: tmp[ID].type,
                                                           value: tmp[ID].store+','+tmp[ID].type,
                                                           valid: ( this.supportedTracks.indexOf(tmp[ID].type ) > -1 ) ? true : false
                                                         };
            }
        }

        var opBar = dom.create( 'div', { className: 'operationBar' } );

        var trackStore = new memory( { data: [/* { name: '', id: ''} */] } );

        // populate the trackStore
        (function() {
            for ( var key in tracks ) {
                if (tracks.hasOwnProperty(key) && tracks[key].valid ) {
                    trackStore.put( { name: key, id: key } );
                }
            }
        })();

        var updateStore = function( type ) {
            if (type) {
                for (var key in tracks ) {
                    if (tracks.hasOwnProperty(key) && (tracks[key].type != type)) {
                        trackStore.remove(key);
                    }
                }
            }
            else {
                trackStore.data = [];
                for (var key in tracks ) {
                    if (tracks.hasOwnProperty(key)) {
                        trackStore.put( { name: key, id: key } );
                    }
                }
            }
        }

        var cBox = new FilteringSelect( { id: selectorTitle+'TrackFinder',
                                          name: 'track',
                                          value: '',
                                          store: trackStore,
                                          required: false,
                                          searchAttr: 'name'
                                        }, 'trackFinder');

        new Button({ iconClass: 'minusIcon',
                     multiselect: selector,
                     onClick: function() {
                        // Orphan the selected children :D
                        dojo.query('option', selector.domNode)
                            .filter(function(n){return n.selected;}).orphan();
                        if (args.filter && dojo.query('option', selector.domNode).length <= 0)
                            updateStore();
                        // trigger selector event
                        on.emit(selector.domNode, "change", {
                            bubbles: true,
                            cancelable: true
                        });
                     }
                   })
            .placeAt( opBar );
        new Button({ iconClass: 'plusIcon',
                     multiselect: selector,
                     onClick: dojo.hitch(this, function() {
                        var key = cBox.get('value');
                        if ( !key )
                            return;
                        if (args.filter) {
                            updateStore(tracks[key].type);
                        }
                        var op = window.doc.createElement('option');
                        op.innerHTML = key;
                        op.type = tracks[key].type;
                        op.value = tracks[key].value;
                        selector.containerNode.appendChild(op);
                        // trigger selector event
                        on.emit(selector.domNode, "change", {
                            bubbles: true,
                            cancelable: true
                        });
                     })
                   })
            .placeAt( opBar );
        cBox.placeAt( opBar );

        container.appendChild(title);
        container.appendChild(selector.domNode);
        container.appendChild(opBar);

        return { domNode: container, sel: selector };
    },

    _makeNameField: function( text ) {
        var name = new TextBox( { value: "",
                                  placeHolder: text
                                } );
        name.domNode.className = 'nameField';
        return name;
    }

});
});