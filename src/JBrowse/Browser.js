var _gaq = _gaq || []; // global task queue for Google Analytics

define( [
            'dojo/_base/declare',
            'dojo/_base/lang',
            'dojo/dom',
            'dojo/dom-construct',
            'dojo/io-query',
            'dojo/json',
            'dojo/on',
            'dojo/Deferred',
            'dojo/promise/all',
            'dojo/topic',
            'dojo/aspect',
            'dojo/request',
            'dojo/store/DataStore',

            'dojo/_base/array',
            'dijit/layout/ContentPane',
            'dijit/layout/BorderContainer',
            'dijit/Dialog',
            'dijit/form/Button',
            'dijit/form/Select',
            'dijit/form/ToggleButton',
            'dijit/form/DropDownButton',
            'dijit/DropDownMenu',
            'dijit/MenuItem',
            'dijit/focus',

            'lazyload', // for dynamic CSS loading

            'JBrowse/has',
            'JBrowse/Component',
            'JBrowse/Util',
            'JBrowse/Store/LazyTrie',
            'JBrowse/Store/Names/LazyTrieDojoData',
            'JBrowse/Store/Names/Hash',
            'JBrowse/FeatureFiltererMixin',
            'JBrowse/Auth/_AuthManagerMixin',
            'JBrowse/Transport/_TransportManagerMixin',
            'JBrowse/View/RegionBrowser2',
            'JBrowse/ConfigManager',
            'JBrowse/Model/SimpleFeature',
            'JBrowse/View/Dialog/Info',
            'JBrowse/View/FileDialog',
            'JBrowse/View/LocationChoiceDialog',
            'JBrowse/View/Dialog/SetHighlight',
            'JBrowse/View/Dialog/QuickHelp',
            'JBrowse/View/Auth/Keyring'
        ],
        function(
            declare,
            lang,
            dom,
            domConstruct,
            ioQuery,
            JSON,
            on,
            Deferred,
            all,
            topic,
            aspect,
            request,
            DojoDataStore,

            array,
            dijitContentPane,
            dijitBorderContainer,
            dijitDialog,
            dijitButton,
            dijitSelectBox,
            dijitToggleButton,
            dijitDropDownButton,
            dijitDropDownMenu,
            dijitMenuItem,
            dijitFocus,

            LazyLoad,

            has,
            JBrowseComponent,
            Util,
            LazyTrie,
            NamesLazyTrieDojoDataStore,
            NamesHashStore,
            FeatureFiltererMixin,
            AuthManagerMixin,
            TransportManagerMixin,
            RegionBrowser2,
            ConfigLoader,
            SimpleFeature,
            InfoDialog,
            FileDialog,
            LocationChoiceDialog,
            SetHighlightDialog,
            HelpDialog,
            KeyringView
        ) {

var dojof = Util.dojof;

/**
 * Construct a new Browser object.
 * @class This class is the main interface between JBrowse and embedders
 * @constructor
 * @param params an object with initial configuration
 */
return declare( [JBrowseComponent,FeatureFiltererMixin,AuthManagerMixin,TransportManagerMixin], {

// set constructor method chaining to manual, we need to do some special things
"-chains-": { constructor: "manual" },

constructor: function(params) {
    this.browser = this;

    this.globalKeyboardShortcuts = {};

    this._constructorArgs = this._parseQueryString( params || {} );

    // if we're in the unit tests, stop here and don't do any more initialization
    if( this._constructorArgs.unitTestMode ) {
        this._initTransportDrivers();
        this._finalizeConfig( this._constructorArgs || {} );
        return;
    }

    this.startTime = new Date();

    this.container = dom.byId( params.container );
    this.container.onselectstart = function() { return false; };

    this.trackConfigsByName = {};

    // start the initialization process
    var thisB = this;
    thisB.loadConfig().then( function() {
        thisB._initTransportDrivers();

        // initialize our highlight if one was set in the config
        if( thisB.getConf('highlight') )
            thisB.setHighlight( Util.parseLocString( thisB.getConf('highlight') ) );

        thisB.loadNames();
        thisB.initPlugins().then( function() {
            thisB.loadCSS().then( function() {

                thisB.initTrackMetadata();

                thisB.initView().then( function() {
                       thisB.passMilestone( 'completely initialized', { success: true } );
                });

                thisB.reportUsageStats();
            });
        });
    });
 },

configSchema: {
        slots: [
            { name: 'plugins',  type: 'multi-object' },
            { name: 'dataRoot', type: 'string', defaultValue: "data" },
            { name: 'location', type: 'string', defaultValue: 'ctgA:1000..4000' }, // TODO remove this
            { name: 'browserRoot', type: 'string', defaultValue: "" },
            { name: 'css', type: 'multi-string|object' },
            { name: 'names', type: 'object', defaultValue: {} },
            { name: 'nameUrl', type: 'string', defaultValue: function(b) { return b.getConf('dataRoot')+'/names/root.json'; } },
            { name: 'unitTestMode', type: 'boolean', defaultValue: false },
            { name: 'devMode', type: 'boolean', defaultValue: false },
            { name: 'exactReferenceSequenceNames', type: 'boolean', defaultValue: false },
            { name: 'dijitTheme', type: 'string', defaultValue: 'tundra' },
            { name: 'theme', type: 'string', defaultValue: 'metro' },
            { name: 'showTracks', type: 'string', defaultValue: '' },
            { name: 'updateBrowserURL', type: 'boolean', defaultValue: true },
            { name: 'datasets', type: 'object', defaultValue: {} },
            { name: 'dataset_id', type: 'string' },
            { name: 'quickHelp', type: 'object', defaultValue: {} },
            { name: 'highlight', type: 'string' },
            { name: 'aboutThisBrowser', type: 'object', defaultValue: {} },
            { name: 'suppressUsageStatistics', type: 'boolean', defaultValue: false },
            { name: 'stores', type: 'object', defaultValue: { url: { type: "JBrowse/Store/SeqFeature/FromConfig", features: [] } } },
            { name: 'tracks', type: 'multi-object' },
            { name: 'logMessages', type: 'boolean', defaultValue: false },
            { name: 'maxRecentTracks', type: 'integer', defaultValue: 10 },
            { name: 'trackMetadata', type: 'object', defaultValue: { sources: [] } },
            { name: 'trackSelector', type: 'object', defaultValue: {} },
            { name: 'share_link', type: 'boolean', defaultValue: true },
            { name: 'shareURL', type: 'string',
              defaultValue: function( browser, overrides ) {
                  var viewState = {
                      highlight: (browser.getHighlight()||'').toString(),
                      dataRoot: browser.getConf('dataRoot')
                  };

                  return "".concat(
                      window.location.protocol,
                      "//",
                      window.location.host,
                      window.location.pathname,
                      "?",
                      dojo.objectToQuery(
                          dojo.mixin( viewState,
                                      overrides || {}
                                    )
                      )
                  );
              }},
            { name: 'cookieSizeLimit', type: 'integer', defaultValue: 1200 },
            { name: 'refSeqSelectorMaxSize', type: 'integer', defaultValue: 30 }
        ]
},

version: function() {
    // when a build is put together, the build system assigns a string
    // to the variable below.
    var BUILD_SYSTEM_JBROWSE_VERSION;
    return BUILD_SYSTEM_JBROWSE_VERSION || 'development';
}.call(),

/**
 * If a `queryString` attr is present in the passed object, parse it
 * as a query string containing additional configuration, returning a
 * new object containing the query string configuration mixed in.
 */
_parseQueryString: function( constructorArgs ) {
    if(! constructorArgs.queryString )
        return constructorArgs;

    var queryConfig = ioQuery.queryToObject( constructorArgs.queryString.replace(/^\?/,'') );

    // parse any JSON strings in the configuration
    for( var varName in queryConfig ) {
        var jsonString = (queryConfig[varName]||'').replace( /^json:/i, '' );
        if( jsonString != queryConfig[varName] ) {
            try {
                queryConfig[varName] = JSON.parse( jsonString );
            } catch( error ) {
                console.error( 'Error parsing JSON in URL '+varName+': '+error );
            }
        }
        else if( queryConfig[varName] == 'true' ) {
            queryConfig[varName] = true;
        }
        else if( queryConfig[varName] == 'false' ) {
            queryConfig[varName] = false;
        }
    }

    if( !( 'include' in queryConfig ) ) {
        queryConfig.include = [
            'jbrowse_conf.json',
            '{dataRoot}/trackList.json'
        ];
    }

    var newargs = lang.mixin( {}, constructorArgs, queryConfig );
    delete newargs.queryString;
    return newargs;
},

/**
 * Get a plugin, if it is present.  Note that, if plugin
 * initialization is not yet complete, it may be a while before the
 * callback is called.
 *
 * Callback is called with one parameter, the desired plugin object,
 * or undefined if it does not exist.
 */
getPlugin: function( name, callback ) {
    this.afterMilestone( 'initPlugins', dojo.hitch( this, function() {
        callback( this.plugins[name] );
    }));
},

_corePlugins: function() {
    return ['RegexSequenceSearch'];
},

/**
 * Load and instantiate any plugins defined in the configuration.
 */
initPlugins: function() {
    return this._milestoneFunction( 'initPlugins', function( deferred ) {
        this.plugins = {};

        var plugins = this._corePlugins();
        plugins.push.apply( plugins, this.getConf('plugins') );

        if( ! plugins ) {
            deferred.resolve({success: true});
            return;
        }

        // coerce plugins to array of objects
        plugins = array.map( lang.isArray( plugins ) ? plugins : [plugins], function( p ) {
            return typeof p == 'object' ? p : { 'name': p };
        });

        // set default locations for each plugin
        array.forEach( plugins, function(p) {
            if( !( 'location' in p ))
                p.location = 'plugins/'+p.name;

            var resolved = this.resolveUrl( p.location );

            // figure out js path
            if( !( 'js' in p ))
                p.js = p.location+"/js"; //URL resolution for this is taken care of by the JS loader
            if( p.js.charAt(0) != '/' && ! /^https?:/i.test( p.js ) )
                p.js = '../'+p.js;

            // figure out css path
            if( !( 'css' in p ))
                p.css = resolved+"/css";
        },this);

        var pluginDeferreds = array.map( plugins, function(p) {
            return new Deferred();
        });

        // fire the "all plugins done" deferred when all of the plugins are done loading
        all( pluginDeferreds )
            .then( function() { deferred.resolve({success: true}); });

        require( {
                     packages: array.map( plugins, function(p) {
                                              return {
                                                  name: p.name,
                                                  location: p.js
                                              };
                                          }, this )
                 },
                 array.map( plugins, function(p) { return p.name; } ),
                 dojo.hitch( this, function() {
                     array.forEach( arguments, function( pluginClass, i ) {
                             var plugin = plugins[i];
                             var thisPluginDone = pluginDeferreds[i];
                             if( typeof pluginClass == 'string' ) {
                                 console.error("could not load plugin "+plugin.name+": "+pluginClass);
                             } else {
                                 // make the plugin's arguments out of
                                 // its little obj in 'plugins', and
                                 // also anything in the top-level
                                 // conf under its plugin name
                                 var args = lang.mixin( {}, plugins[i], { config: plugin.config || {} });
                                 args.browser = this;
                                 args = dojo.mixin( args, { browser: this } );

                                 // load its css
                                 var cssLoaded = this._loadCSS(
                                     {url: this.resolveUrl( plugin.css+'/main.css' ) }
                                 );
                                 cssLoaded.then( function() {
                                     thisPluginDone.resolve({success:true});
                                 });

                                 // give the plugin access to the CSS
                                 // promise so it can know when its
                                 // CSS is ready
                                 args.cssLoaded = cssLoaded;

                                 // instantiate the plugin
                                 this.plugins[ plugin.name ] = new pluginClass( args );
                             }
                         }, this );
                  }));
    });
},

/**
 * Resolve a URL relative to the browserRoot.
 */
resolveUrl: function( url ) {
    var browserRoot = this.getConf('browserRoot');
    if( browserRoot && browserRoot.charAt( browserRoot.length - 1 ) != '/' )
        browserRoot += '/';

    return Util.resolveUrl( browserRoot, url );
},

resolveThemeUrl: function( relUrl ) {
    return this.resolveUrl( 'themes/'+this.getConf('theme')+'/'+relUrl );
},

/**
 * Displays links to configuration help in the main window.  Called
 * when the main browser cannot run at all, due to configuration
 * errors or whatever.
 */
fatalError: function( error ) {
    if( error ) {
        error = error+'';
        if( ! /\.$/.exec(error) )
            error = error + '.';
    }
    if( ! this.hasFatalErrors ) {
        var container =
            dom.byId( 'GenomeBrowser' )
            || document.body;
        container.innerHTML = ''
            + '<div class="fatal_error">'
            + '  <h1>Congratulations, JBrowse is on the web!</h1>'
            + "  <p>However, JBrowse could not start, either because it has not yet been configured"
            + "     and loaded with data, or because of an error.</p>"
            + "  <p style=\"font-size: 110%; font-weight: bold\">If this is your first time running JBrowse, <a title=\"View the tutorial\" href=\"docs/tutorial/\" target=\"_blank\">click here to follow the Quick-start Tutorial to show your data in JBrowse.</a></p>"
            + '  <p id="volvox_data_placeholder"></p>'
            + "  <p>Otherwise, please refer to the following resources for help in setting up JBrowse to show your data.</p>"
            + '  <ul><li><a target="_blank" href="docs/tutorial/">Quick-start tutorial</a> - get your data visible quickly with minimum fuss</li>'
            + '      <li><a target="_blank" href="http://gmod.org/wiki/JBrowse_Configuration_Guide">JBrowse Configuration Guide</a> - a comprehensive reference</li>'
            + '      <li><a target="_blank" href="http://gmod.org/wiki/JBrowse">JBrowse wiki main page</a></li>'
            + '      <li><a target="_blank" href="docs/config.html"><code>biodb-to-json.pl</code> configuration reference</a></li>'
            + '      <li><a target="_blank" href="docs/featureglyphs.html">HTMLFeatures CSS class reference</a> - prepackaged styles (CSS classes) for HTMLFeatures tracks</li>'
            + '  </ul>'
            + '  <div id="fatal_error_list" class="errors"> <h2>Error message(s):</h2>'
            + ( error ? '<div class="error"> '+error+'</div>' : '' )
            + '  </div>'
            + '</div>'
            ;
        request( 'sample_data/json/volvox/successfully_run' )
        .then( function() {
                   try {
                       dom.byId('volvox_data_placeholder')
                           .innerHTML = 'Also, it appears you have successfully run <code>./setup.sh</code>, so you can see the <a href="?data=sample_data/json/volvox" target="_blank">Volvox test data</a> here.';
                   } catch(e) {}
               });

        this.hasFatalErrors = true;
    } else {
        var errors_div = dom.byId('fatal_error_list') || document.body;
        dojo.create('div', { className: 'error', innerHTML: error+'' }, errors_div );
    }
},

/**
 * Event that fires when the reference sequences have been loaded.
 */
onRefSeqsLoaded: function() {
},

loadCSS: function() {
    return this._milestoneFunction( 'loadCSS', function( deferred ) {
        var css = this.getConf('css');
        css.unshift( this.resolveThemeUrl( 'css/main.css' ) );

        var thisB = this;
        var cssDeferreds = array.map( css, function( css ) {
            return thisB._loadCSS( css );
        });

        all(cssDeferreds)
            .then( function() { deferred.resolve({success:true}); } );
   });
},

_loadCSS: function( css ) {
    var deferred = new Deferred();
    if( typeof css == 'string' ) {
        // if it has '{' in it, it probably is not a URL, but is a string of CSS statements
        if( css.indexOf('{') > -1 ) {
            dojo.create('style', { "data-from": 'JBrowse Config', type: 'text/css', innerHTML: css }, document.head );
            deferred.resolve(true);
        }
        // otherwise, it must be a URL
        else {
            css = { url: css };
        }
    }
    if( typeof css == 'object' ) {
        LazyLoad.css( css.url, function() { deferred.resolve(true); } );
    }
    return deferred;
},

/**
 * Load our name index.
 */
loadNames: function() {
    return this._milestoneFunction( 'loadNames', function( deferred ) {
        var conf = lang.mixin( {}, this.getConf('names') );
        if( ! conf.url )
            conf.url = this.getConf('nameUrl');

        if( conf.baseUrl )
            conf.url = Util.resolveUrl( conf.baseUrl, conf.url );

        if( conf.type == 'Hash' )
            this.nameStore = new NamesHashStore( dojo.mixin({ browser: this }, conf) );
        else
            // wrap the older LazyTrieDojoDataStore with
            // dojo.store.DataStore to conform with the dojo/store API
            this.nameStore = new DojoDataStore({
                store: new NamesLazyTrieDojoDataStore({
                    browser: this,
                    namesTrie: new LazyTrie( conf.url, "lazy-{Chunk}.json"),
                    stopPrefixes: conf.stopPrefixes,
                    resultLimit:  conf.resultLimit || 15,
                    tooManyMatchesMessage: conf.tooManyMatchesMessage
                })
            });

        deferred.resolve({success: true});
    });
},

/**
 * Compare two reference sequence names, returning -1, 0, or 1
 * depending on the result.  Case insensitive, insensitive to the
 * presence or absence of prefixes like 'chr', 'chrom', 'ctg',
 * 'contig', 'scaffold', etc
 */
compareReferenceNames: function( a, b ) {
    return this.regularizeReferenceName(a).localeCompare( this.regularizeReferenceName( b ) );
},

regularizeReferenceName: function( refname ) {

    if( this.getConf('exactReferenceSequenceNames') )
        return refname;

    refname = refname.toLowerCase()
                     .replace(/^chro?m?(osome)?/,'chr')
                     .replace(/^co?n?ti?g/,'ctg')
                     .replace(/^scaff?o?l?d?/,'scaffold')
                     .replace(/^([a-z]*)0+/,'$1')
                     .replace(/^(\d+)$/, 'chr$1' );

    return refname;
},

getState: function() {
    var s = this.inherited( arguments );
    s.views = array.map( this.views, function(v) { return v.getState(); } );
    return s;
},

initView: function() {
    var thisB = this;
    return this._milestoneFunction('initView', function( deferred ) {

        dojo.addClass( this.container, "jbrowse"); // browser container has an overall .jbrowse class
        dojo.addClass( document.body, this.getConf('dijitTheme') );
        dojo.addClass( this.container, this.getConf('theme') );

        // make our top menu bar
        var menuBar = thisB.menuBar = dojo.create('div',{className:  'menuBar' },this.container);

        this.renderMenuBar( menuBar );

        // make the keyring control
        this.keyringControl = new KeyringView({ browser: this });
        menuBar.appendChild( this.keyringControl.getButton().domNode );

        menuBar.appendChild( this.makeShareLink() );

        this.containerWidget = new dijitBorderContainer({
            liveSplitters: false,
            design: "sidebar",
            gutters: false
        }, this.container);

        var contentWidget =
            new dijitContentPane({region: "top"}, menuBar );

        // figure out what initial track list we will use:
        //    from a param passed to our instance, or from a cookie, or
        //    the passed defaults, or the last-resort default of "DNA"?
        var initialTracks =
               thisB.getConf('showTracks')
            || "DNA";

        // instantiate our views
        this.views = [
            new RegionBrowser2(
                { browser: this,
                  config: {
                      name: 'View 1',
                      className: 'colorScheme1',
                      region: 'top',
                      style: 'height: 40%',
                      location: Util.parseLocString( this.getConf('location') ), // todo remove this
                      tracks: initialTracks.split(',')
                  }
                } )
            ];
         this.views.push(
             new RegionBrowser2(
                 { browser: this,
                   config: {
                       className: 'colorScheme2',
                       region: 'center',
                       parentViewName: 'View 1',
                       tracks: initialTracks.split(','),
                       location: Util.parseLocString( this.getConf('location') ), // todo remove this
                   }
                 })
         );

        array.forEach( this.views, function(v) {
            v.placeAt( this.container );
        }, this );

        //connect events to update the URL in the location bar
        function updateLocationBar() {
            var shareURL = thisB.getConf('shareURL');
            if( thisB.getConf('updateBrowserURL') && window.history && window.history.replaceState )
                window.history.replaceState( {},"", shareURL );
            document.title = thisB.browserMeta().title;
        };

        this.subscribe( '/jbrowse/v1/n/navigate',  updateLocationBar );
        this.subscribe( '/jbrowse/v1/n/tracks/visibleChanged',  updateLocationBar );
        this.subscribe( '/jbrowse/v1/n/globalhighlight/changed', updateLocationBar );

        //set initial location
        //this.createTrackList().then( dojo.hitch( this, function() {
            this.containerWidget.startup();

            // make our global keyboard shortcut handler
            on( document.body, 'keypress', dojo.hitch( this, 'globalKeyHandler' ));

            // configure our event routing
            this._initEventRouting();

            // done with initView
            deferred.resolve({ success: true });
//      }));
    });
},

getView: function( name ) {
    var v = this.views || [];
    for( var i = 0; i < v.length; i++ ) {
        if( v[i].getConf('name') == name )
            return v[i];
    }
    return undefined;
},

renderMenuBar: function( menuBar ) {
    var thisB = this;
    var about = this.browserMeta();
    var aboutDialog = new InfoDialog(
        {
            browser: this,
            title: 'About '+about.title,
            content: about.description,
            className: 'about-dialog'
        });

    if( this.getConf('datasets').length && ! this.getConf('dataset_id') ) {
        console.warn("In JBrowse configuration, datasets specified, but dataset_id not set.  Dataset selector will not be shown.");
    }

    this.poweredByLink = dojo.create('a', {
                                         className: 'powered_by',
                                         innerHTML: '<img src="'+this.resolveThemeUrl('img/menubar_logo.png')+'">',
                                         onclick: dojo.hitch( aboutDialog, 'show' ),
                                         title: 'powered by JBrowse'
                                     }, menuBar );

    if( this.getConf('datasets') && this.getConf('dataset_id') ) {
        this.renderDatasetSelect( menuBar );
    }

    // make the file menu
    this.addGlobalMenuItem( 'file',
                            new dijitMenuItem(
                                {
                                    label: 'Open',
                                    iconClass: 'dijitIconFolderOpen',
                                    onClick: dojo.hitch( this, 'openFileDialog' )
                                })
                          );
    this.addGlobalMenuItem( 'file', new dijitMenuItem(
                                {
                                    label: 'Add combination track',
                                    iconClass: 'dijitIconSample',
                                    onClick: dojo.hitch(this, 'createCombinationTrack')
                                }));

    this.renderGlobalMenu( 'file', {text: 'File'}, menuBar );


    // make the view menu
    this.addGlobalMenuItem(
        'view',
        new dijitMenuItem(
            {
                label: 'Set highlight',
                iconClass: 'dijitIconFilter',
                onClick: function() {
                    new SetHighlightDialog({
                                               browser: thisB,
                                               setCallback: dojo.hitch( thisB, 'setHighlightAndRedraw' )
                                           }).show();
                }
            }));
    // make the menu item for clearing the current highlight
    this._highlightClearButton = new dijitMenuItem(
        {
            label: 'Clear highlight',
            iconClass: 'dijitIconFilter',
            onClick: dojo.hitch( this, function() {
                                     var h = this.getHighlight();
                                     if( h ) {
                                         this.clearHighlight();
                                         this.publish( '/jbrowse/v1/c/redrawGenomeRegions', [h] );
                                     }
                                 })
        });
    this._updateHighlightClearButton();  //< sets the label and disabled status
    // update it every time the highlight changes
    this.subscribe( '/jbrowse/v1/n/globalhighlight/changed', dojo.hitch( this, '_updateHighlightClearButton' ) );

    this.addGlobalMenuItem( 'view', this._highlightClearButton );
    this.renderGlobalMenu( 'view', {text: 'View'}, menuBar );

    // make the options menu
    this.renderGlobalMenu( 'options', { text: 'Options', title: 'configure JBrowse' }, menuBar );

    // make the help menu
    this.addGlobalMenuItem( 'help',
                            new dijitMenuItem(
                                {
                                    label: 'About',
                                    //iconClass: 'dijitIconFolderOpen',
                                    onClick: dojo.hitch( aboutDialog, 'show' )
                                })
                          );

    function showHelp() {
        new HelpDialog( lang.mixin( lang.mixin({},thisB.getConf('quickHelp'))), { browser: thisB } ).show();
    }
    this.setGlobalKeyboardShortcut( '?', showHelp );
    this.addGlobalMenuItem( 'help',
                            new dijitMenuItem(
                                {
                                    label: 'General',
                                    iconClass: 'jbrowseIconHelp',
                                    onClick: showHelp
                                })
                          );

    this.renderGlobalMenu( 'help', {}, menuBar );
},

createCombinationTrack: function() {
    if(this._combinationTrackCount === undefined) this._combinationTrackCount = 0;
    var d = new Deferred();
    var storeConf = {
        browser: this,
        refSeq: this.refSeq,
        type: 'JBrowse/Store/SeqFeature/Combination'
    };
    var storeName = this.addStoreConfig(undefined, storeConf);
    storeConf.name = storeName;
    this.getStore(storeName, function(store) {
        d.resolve(true);
    });
    var thisB = this;
    d.promise.then(function(){
        var combTrackConfig = {
            type: 'JBrowse/View/Track/Combination',
            label: "combination_track" + (thisB._combinationTrackCount++),
            key: "Combination Track " + (thisB._combinationTrackCount),
            metadata: {Description: "Drag-and-drop interface that creates a track out of combinations of other tracks."},
            store: storeName
        };
        // send out a message about how the user wants to create the new tracks
        thisB.publish( '/jbrowse/v1/v/tracks/new', [combTrackConfig] );

        // Open the track immediately
        thisB.publish( '/jbrowse/v1/v/tracks/show', [combTrackConfig] );
    });
},

renderDatasetSelect: function( parent ) {
    var dsconfig = this.getConf('datasets');
    var datasetChoices = [];
    for( var id in dsconfig ) {
        datasetChoices.push( dojo.mixin({ id: id }, dsconfig[id] ) );
    }

    new dijitSelectBox(
        {
            name: 'dataset',
            className: 'dataset_select',
            value: this.getConf('dataset_id'),
            options: array.map(
                datasetChoices,
                function( dataset ) {
                    return { label: dataset.name, value: dataset.id };
                }),
            onChange: dojo.hitch(this, function( dsID ) {
                                     var ds = (this.getConf('datasets'))[dsID];
                                     if( ds )
                                         window.location = ds.url;
                                     return false;
                                 })
        }).placeAt( parent );
},

/**
 * Get object like { title: "title", description: "description", ... }
 * that contains metadata describing this browser.
 */
browserMeta: function() {
    var about = lang.mixin({},this.getConf('aboutThisBrowser'));
    about.title = about.title || 'JBrowse';

    var verstring = this.version && this.version.match(/^\d/)
        ? this.version : '(development version)';

    if( about.description ) {
        about.description += '<div class="powered_by">'
            + 'Powered by <a target="_blank" href="http://jbrowse.org">JBrowse '+verstring+'</a>.'
            + '</div>';
    }
    else {
        about.description = '<div class="default_about">'
            + '  <img class="logo" src="'+this.resolveUrl('img/JBrowseLogo_small.png')+'">'
            + '  <h1>JBrowse '+verstring+'</h1>'
            + '  <div class="tagline">A next-generation genome browser<br> built with JavaScript and HTML5.</div>'
            + '  <a class="mainsite" target="_blank" href="http://jbrowse.org">JBrowse website</a>'
            + '  <div class="gmod">JBrowse is a <a target="_blank" href="http://gmod.org">GMOD</a> project.</div>'
            + '  <div class="copyright">&copy; 2013 The Evolutionary Software Foundation</div>'
            + '</div>';
    }
    return about;
},

/**
 * Track type registry, used by GUI elements that need to offer
 * options regarding selecting track types.  Can register a track
 * type, and get the data structure describing what track types are
 * known.
 */
registerTrackType: function( args ) {

    var types = this.getTrackTypes();
    var typeName   = args.type;
    var defaultFor = args.defaultForStoreTypes || [];
    var humanLabel = args.label;

    // add it to known track types
    types.knownTrackTypes.push( typeName );

    // add its label
    if( args.label )
        types.trackTypeLabels[typeName] = args.label;

    // uniqify knownTrackTypes
    var seen = {};
    types.knownTrackTypes = array.filter( types.knownTrackTypes, function( type ) {
        var s = seen[type];
        seen[type] = true;
        return !s;
    });

    // set it as default for the indicated types, if any
    array.forEach( defaultFor, function( storeName ) {
        types.trackTypeDefaults[storeName] = typeName;
    });

    // store the whole structure in this object
    this._knownTrackTypes = types;
},
getTrackTypes: function() {
    // create the default types if necessary
    if( ! this._knownTrackTypes )
        this._knownTrackTypes = {
            // map of store type -> default track type to use for the store
            trackTypeDefaults: {
                'JBrowse/Store/SeqFeature/BAM'        : 'JBrowse/View/Track/Alignments2',
                'JBrowse/Store/SeqFeature/NCList'     : 'JBrowse/View/Track/CanvasFeatures',
                'JBrowse/Store/SeqFeature/BigWig'     : 'JBrowse/View/Track/Wiggle/XYPlot',
                'JBrowse/Store/Sequence/StaticChunked': 'JBrowse/View/Track/Sequence',
                'JBrowse/Store/SeqFeature/VCFTabix'   : 'JBrowse/View/Track/CanvasVariants',
                'JBrowse/Store/SeqFeature/GFF3'       : 'JBrowse/View/Track/CanvasFeatures'
            },

            knownTrackTypes: [
                'JBrowse/View/Track/Alignments',
                'JBrowse/View/Track/Alignments2',
                'JBrowse/View/Track/FeatureCoverage',
                'JBrowse/View/Track/SNPCoverage',
                'JBrowse/View/Track/HTMLFeatures',
                'JBrowse/View/Track/CanvasFeatures',
                'JBrowse/View/Track/HTMLVariants',
                'JBrowse/View/Track/CanvasVariants',
                'JBrowse/View/Track/Wiggle/XYPlot',
                'JBrowse/View/Track/Wiggle/Density',
                'JBrowse/View/Track/Sequence'
            ],

            trackTypeLabels: {
            }
        };

    return this._knownTrackTypes;
},



openFileDialog: function() {
    new FileDialog({ browser: this })
        .show({
            openCallback: dojo.hitch( this, function( results ) {
                var confs = results.trackConfs || [];
                if( confs.length ) {

                    // tuck away each of the store configurations in
                    // our store configuration, and replace them with
                    // their names.
                    array.forEach( confs, function( conf ) {
                        var storeConf = conf.store;
                        if( storeConf && typeof storeConf == 'object' ) {
                            delete conf.store;
                            var name = this.addStoreConfig( storeConf.name, storeConf );
                            conf.store = name;
                        }
                    },this);

                    // send out a message about how the user wants to create the new tracks
                    this.publish( '/jbrowse/v1/v/tracks/new', confs );

                    // if requested, send out another message that the user wants to show them
                    if( results.trackDisposition == 'openImmediately' )
                        this.publish( '/jbrowse/v1/v/tracks/show', confs );
                }
            })
        });
},

addTracks: function( confs ) {
    // just register the track configurations right now
    this._addTrackConfigs( confs );
},
replaceTracks: function( confs ) {
    // just add-or-replace the track configurations
    this._replaceTrackConfigs( confs );
},
deleteTracks: function( confs ) {
    // de-register the track configurations
    this._deleteTrackConfigs( confs );
},

renderGlobalMenu: function( menuName, args, parent ) {
    this.afterMilestone( 'initView', function() {
        var menu = this.makeGlobalMenu( menuName );
        if( menu ) {
            args = dojo.mixin(
                {
                    className: menuName,
                    innerHTML: '<span class="icon"></span> '+ ( args.text || Util.ucFirst(menuName)),
                    dropDown: menu,
                    id: 'dropdownbutton_'+menuName
                },
                args || {}
            );

            var menuButton = new dijitDropDownButton( args );
            dojo.addClass( menuButton.domNode, 'menu' );
            parent.appendChild( menuButton.domNode );
        }
    },this);
},

makeGlobalMenu: function( menuName ) {
    var items = ( this._globalMenuItems || {} )[menuName] || [];
    if( ! items.length )
        return null;

    var menu = new dijitDropDownMenu({ id: 'dropdownmenu_'+menuName , leftClickToOpen: true });
    dojo.forEach( items, function( item ) {
        menu.addChild( item );
    });
    dojo.addClass( menu.domNode, 'globalMenu' );
    dojo.addClass( menu.domNode, menuName );
    menu.startup();
    return menu;
},

addGlobalMenuItem: function( menuName, item ) {
    if( ! this._globalMenuItems )
        this._globalMenuItems = {};
    if( ! this._globalMenuItems[ menuName ] )
        this._globalMenuItems[ menuName ] = [];
    this._globalMenuItems[ menuName ].push( item );
},

/**
 * Initialize our message routing, subscribing to messages, forwarding
 * them around, and so forth.
 *
 * "v" (view)
 *   Requests from the user.  These go only to the browser, which is
 *   the central point forx deciding what to do about them.  This is
 *   usually just forwarding the command as one or more "c" messages.
 *
 * "c" (command)
 *   Commands from authority, like the Browser object.  These cause
 *   things to actually happen in the UI: things to be shown or
 *   hidden, actions taken, and so forth.
 *
 * "n" (notification)
 *   Notification that something just happened.
 *
 * @private
 */
_initEventRouting: function() {
    var that = this;

    that.subscribe('/jbrowse/v1/v/store/new', function( storeConfigs ) {
        array.forEach( storeConfigs, function( storeConfig ) {
                           storeConfig = lang.mixin( {}, storeConfig );
                           var name = storeConfig.name;
                           delete storeConfig.name;
                           that.addStoreConfig( name, storeConfig );
                       });
    });



    that.subscribe('/jbrowse/v1/v/tracks/hide', function( trackConfigs ) {
        that.publish( '/jbrowse/v1/c/tracks/hide', trackConfigs );
    });
    that.subscribe('/jbrowse/v1/v/tracks/show', function( trackConfigs ) {
        that.addRecentlyUsedTracks( dojo.map(trackConfigs, function(c){ return c.label;}) );
        that.publish( '/jbrowse/v1/c/tracks/show', trackConfigs );
    });

    that.subscribe('/jbrowse/v1/v/tracks/new', function( trackConfigs ) {
        that.addTracks( trackConfigs );
        that.publish( '/jbrowse/v1/c/tracks/new', trackConfigs );
        that.publish( '/jbrowse/v1/n/tracks/new', trackConfigs );
    });
    that.subscribe('/jbrowse/v1/v/tracks/replace', function( trackConfigs ) {
        that.replaceTracks( trackConfigs );
        that.publish( '/jbrowse/v1/c/tracks/replace', trackConfigs );
        that.publish( '/jbrowse/v1/n/tracks/replace', trackConfigs );
    });
    that.subscribe('/jbrowse/v1/v/tracks/delete', function( trackConfigs ) {
        that.deleteTracks( trackConfigs );
        that.publish( '/jbrowse/v1/c/tracks/delete', trackConfigs );
        that.publish( '/jbrowse/v1/n/tracks/delete', trackConfigs );
    });

    that.subscribe('/jbrowse/v1/v/tracks/pin', function( trackNames ) {
        that.publish( '/jbrowse/v1/c/tracks/pin', trackNames );
        that.publish( '/jbrowse/v1/n/tracks/pin', trackNames );
    });

    that.subscribe('/jbrowse/v1/v/tracks/unpin', function( trackNames ) {
        that.publish( '/jbrowse/v1/c/tracks/unpin', trackNames );
        that.publish( '/jbrowse/v1/n/tracks/unpin', trackNames );
    });
},

/**
 * Reports some anonymous usage statistics about this browsing
 * instance.  Currently reports the number of tracks in the instance
 * and their type (feature, wiggle, etc), and the number of reference
 * sequences and their average length.
 */
reportUsageStats: function() {
    if( this.getConf('suppressUsageStatistics') || this.getConf('devMode') )
        return;

    var stats = this._calculateClientStats();
    this._reportGoogleUsageStats( stats );
    this._reportCustomUsageStats( stats );
},

// phones home to google analytics
_reportGoogleUsageStats: function( stats ) {
    _gaq.push.apply( _gaq, [
        ['_setAccount', 'UA-7115575-2'],
        ['_setDomainName', 'none'],
        ['_setAllowLinker', true],
        ['_setCustomVar', 1, 'tracks-count', stats['tracks-count'], 3 ],
        ['_setCustomVar', 2, 'refSeqs-count', stats['refSeqs-count'], 3 ],
        ['_setCustomVar', 3, 'refSeqs-avgLen', stats['refSeqs-avgLen'], 3 ],
        ['_setCustomVar', 4, 'jbrowse-version', stats['ver'], 3 ],
        ['_setCustomVar', 5, 'loadTime', stats['loadTime'], 3 ],
        ['_setCustomVar', 5, 'plugins', stats['plugins'], 3 ],
        ['_trackPageview']
    ]);

    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www')
             + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
},

// phones home to custom analytics at jbrowse.org
_reportCustomUsageStats: function(stats) {
    // phone home with a GET request made by a script tag
    dojo.create(
        'img',
        { style: {
              display: 'none'
          },
          src: 'http://jbrowse.org/analytics/clientReport?'
               + dojo.objectToQuery( stats )
        },
        document.body
    );
},


/**
 * Get a store object from the store registry, loading its code and
 * instantiating it if necessary.
 */
getStoreDeferred: function( storeName ) {
    this._storeCache   = this._storeCache || {};
    this._storeClasses = this._storeClasses || {};

    return this._storeCache[ storeName ] || ( this._storeCache[ storeName ] = function() {
        var getStore = new Deferred();

        var conf = this.getConf('stores')[storeName];
        if( ! conf ) {
            getStore.reject( "store '"+storeName+"' not found" );
            return getStore;
        }

        var storeClassName = conf.type;
        if( ! storeClassName ) {
            getStore.reject( "store "+storeName+" has no type defined" );
            return getStore;
        }

        var getStoreClass = this._storeClasses[storeClassName] ||
            ( this._storeClasses[storeClassName] = Util.loadJSClass(storeClassName));

        var thisB = this;
        getStoreClass.then(
            function( storeClass ) {
                var store = new storeClass({ browser: thisB, config: conf });
                getStore.resolve( store );
            },
            lang.hitch( getStore, 'reject' )
        );
        return getStore;

    }.call(this));
},

getStore: function( storeName, callback ) {
    if( !callback ) throw 'invalid arguments';


    this.getStoreDeferred( storeName )
        .then( callback,
               function(e) {
                   console.error(e);
                   callback( null );
               }
             );
},

/**
 * Add a store configuration to the browser.  If name is falsy, will
 * autogenerate one.
 * @private
 */
uniqCounter: 0,
addStoreConfig: function( /**String*/ name, /**Object*/ storeConfig ) {
    name = name || 'addStore'+this.uniqCounter++;

    if( ! this._storeCache )
        this._storeCache = {};

    if( this.getConf('stores')[name] || this._storeCache[name] ) {
        throw "store "+name+" already exists!";
    }

    this.getConf('stores')[name] = storeConfig;
    return name;
},

_calculateClientStats: function() {

    var scn = screen || window.screen;

    // make a flat (i.e. non-nested) object for the stats, so that it
    // encodes compactly in the query string
    var date = new Date();
    var stats = {
        ver: this.version || 'dev',
        'tracks-count': this.getConf('tracks').length,
        'plugins': dojof.keys( this.plugins ).sort().join(','),

        // screen geometry
        'scn-h': scn ? scn.height : null,
        'scn-w': scn ? scn.width  : null,
        // window geometry
        'win-h':document.body.offsetHeight,
        'win-w': document.body.offsetWidth,
        // container geometry
        'el-h': this.container.offsetHeight,
        'el-w': this.container.offsetWidth,

        // time param to prevent caching
        t: date.getTime()/1000,

        // also get local time zone offset
        tzoffset: date.getTimezoneOffset(),

        loadTime: (date.getTime() - this.startTime)/1000
    };

    // count the number and types of tracks
    dojo.forEach( this.getConf('tracks'), function(trackConfig) {
        var typeKey = 'track-types-'+ ( trackConfig.type || 'null' );
        stats[ typeKey ] =
          ( stats[ typeKey ] || 0 ) + 1;
    });

    return stats;
},

publish: function() {
    if( this.getConf('logMessages') )
        console.log( arguments );

    return topic.publish.apply( topic, arguments );
},
subscribe: function() {
    return topic.subscribe.apply( topic, arguments );
},

/**
 * Get the list of the most recently used tracks, stored for this user
 * in a cookie.
 * @returns {Array[Object]} as <code>[{ time: (integer), label: (track label)}]</code>
 */
getRecentlyUsedTracks: function() {
    return dojo.fromJson( this.cookie( 'recentTracks' ) || '[]' );
},

/**
 * Add the given list of tracks as being recently used.
 * @param trackLabels {Array[String]} array of track labels to add
 */
addRecentlyUsedTracks: function( trackLabels ) {
    var seen = {};
    var newRecent =
        Util.uniq(
            dojo.map( trackLabels, function(label) {
                          return {
                              label: label,
                              time: Math.round( new Date() / 1000 ) // secs since epoch
                          };
                      },this)
                .concat( dojo.fromJson( this.cookie('recentTracks'))  || [] ),
            function(entry) {
                return entry.label;
            }
        )
        // limit by default to 20 recent tracks
        .slice( 0, this.getConf('maxRecentTracks') );

    // set the recentTracks cookie, good for one year
    this.cookie( 'recentTracks', newRecent, { expires: 365 } );

    return newRecent;
},

/**
 * Run a function that will eventually resolve the named Deferred
 * (milestone).
 * @param {String} name the name of the Deferred
 */
_milestoneFunction: function( /**String*/ name, func ) {

    var thisB = this;
    var args = Array.prototype.slice.call( arguments, 2 );

    var d = thisB._getDeferred( name );
    args.unshift( d );
    try {
        func.apply( thisB, args ) ;
    } catch(e) {
        console.error( name, e, e.stack );
        d.resolve({ success:false, error: e });
    }

    return d;
},

/**
 * Fetch or create a named Deferred, which is how milestones are implemented.
 */
_getDeferred: function( name ) {
    if( ! this._deferred )
        this._deferred = {};
    return this._deferred[name] = this._deferred[name] || new Deferred();
},
/**
 * Attach a callback to a milestone.
 */
afterMilestone: function( name, func, ctx ) {
    return this._getDeferred(name)
        .then( function() {
                   try {
                       func.call( ctx || this );
                   } catch( e ) {
                       console.error( ''+e, e.stack, e );
                   }
               });
},
/**
 * Indicate that we've reached a milestone in the initalization
 * process.  Will run all the callbacks associated with that
 * milestone.
 */
passMilestone: function( name, result ) {
    return this._getDeferred(name).resolve( result );
},
/**
 * Return true if we have reached the named milestone, false otherwise.
 */
reachedMilestone: function( name ) {
    return this._getDeferred(name).isResolved();
},


/**
 *  Load our configuration file(s) based on the parameters thex
 *  constructor was passed.  Does not return until all files are
 *  loaded and merged in.
 *  @returns nothing meaningful
 */
loadConfig:function () {
    return this._milestoneFunction( 'loadConfig', function( deferred ) {
        var c = new ConfigLoader({ config: this._constructorArgs, defaults: {}, browser: this });
        this._finalizeConfig( this._constructorArgs || {} );
        c.getFinalConfig( dojo.hitch(this, function( finishedConfig ) {
                // pass the tracks configurations through
                // addTrackConfigs so that it will be indexed and such
                var tracks = finishedConfig.tracks || [];
                delete finishedConfig.tracks;

                this._finalizeConfig( finishedConfig, this._getLocalConfig() );

                this._addTrackConfigs( tracks );

                deferred.resolve({success:true});
        }));
    });
},

// override component getconf to pass browser object by default
getConf: function( key, args ) {
    return this.inherited( arguments, [ key, args || [this] ] );
},

getTrackConfig: function( trackname ) {
    var d = new Deferred();
    d.resolve( this.trackConfigsByName[ trackname ] );
    return d;
},

/**
 * Add new track configurations.
 * @private
 */
_addTrackConfigs: function( /**Array*/ configs ) {

    array.forEach( configs, function(conf){

        // if( this.trackConfigsByName[ conf.label ] ) {
        //     console.warn("track with label "+conf.label+" already exists, skipping");
        //     return;
        // }

        this.trackConfigsByName[conf.label] = conf;
        this.getConf('tracks').push( conf );
    },this);

    return configs;
},
/**
 * Replace existing track configurations.
 * @private
 */
_replaceTrackConfigs: function( /**Array*/ newConfigs ) {
    if( ! this.trackConfigsByName )
        this.trackConfigsByName = {};

    array.forEach( newConfigs, function( conf ) {
        if( ! this.trackConfigsByName[ conf.label ] ) {
            console.warn("track with label "+conf.label+" does not exist yet.  creating a new one.");
        }

        this.trackConfigsByName[conf.label] =
                           dojo.mixin( this.trackConfigsByName[ conf.label ] || {}, conf );
   },this);
},
/**
 * Delete existing track configs.
 * @private
 */
_deleteTrackConfigs: function( configsToDelete ) {
    // remove from this.config.tracks
    this.config.tracks = array.filter( this.config.tracks || [], function( conf ) {
        return ! array.some( configsToDelete, function( toDelete ) {
            return toDelete.label == conf.label;
        });
    });

    // remove from trackConfigsByName
    array.forEach( configsToDelete, function( toDelete ) {
        if( ! this.trackConfigsByName[ toDelete.label ] ) {
            console.warn( "track "+toDelete.label+" does not exist, cannot delete" );
            return;
        }

        delete this.trackConfigsByName[ toDelete.label ];
    },this);
},


/**
 * Asynchronously initialize our track metadata.
 */
initTrackMetadata: function( callback ) {
    return this._milestoneFunction( 'initTrackMetadata', function( deferred ) {
        var metaDataSourceClasses = dojo.map(
                                    this.getConf('trackMetadata').sources,
                                    function( sourceDef ) {
                                        var url  = sourceDef.url || 'trackMeta.csv';
                                        var type = sourceDef.type || (
                                                /\.csv$/i.test(url)     ? 'csv'  :
                                                /\.js(on)?$/i.test(url) ? 'json' :
                                                'csv'
                                        );
                                        var storeClass = sourceDef['class']
                                            || { csv: 'dojox/data/CsvStore', json: 'dojox/data/JsonRestStore' }[type];
                                        if( !storeClass ) {
                                            console.error( "No store class found for type '"
                                                           +type+"', cannot load track metadata from URL "+url);
                                            return null;
                                        }
                                        return { class_: storeClass, url: url };
                                    });


        require( Array.prototype.concat.apply( ['JBrowse/Store/TrackMetaData'],
                                               dojo.map( metaDataSourceClasses, function(c) { return c.class_; } ) ),
                 dojo.hitch(this,function( MetaDataStore ) {
                     var mdStores = [];
                     for( var i = 1; i<arguments.length; i++ ) {
                         mdStores.push( new (arguments[i])({url: metaDataSourceClasses[i-1].url}) );
                     }

                     this.trackMetaDataStore =  new MetaDataStore(
                         dojo.mixin( lang.clone( this.getConf('trackMetadata') ), {
                                         trackConfigs: this.getConf('tracks'),
                                         browser: this,
                                         metadataStores: mdStores
                                     })
                     );

                     deferred.resolve({success:true});
        }));
    });
},

/**
 * Asynchronously create the track list.
 * @private
 */
createTrackList: function() {
    return this._milestoneFunction('createTrack', function( deferred ) {
        // find the tracklist class to use
        var tl_class = this.getConf('trackSelector').type  ? this.getConf('trackSelector').type :
                                                             'Simple';
        if( ! /\//.test( tl_class ) )
            tl_class = 'JBrowse/View/TrackList/'+tl_class;

        // load all the classes we need
        require( [ tl_class ],
                 dojo.hitch( this, function( trackListClass ) {
                     // instantiate the tracklist and the track metadata object
                     this.trackListView = new trackListClass(
                         dojo.mixin(
                             lang.clone( this.getConf('trackSelector') ),
                             {
                                 trackConfigs: this.getConf('tracks'),
                                 browser: this,
                                 trackMetaData: this.trackMetaDataStore
                             }
                         )
                     );

                     // bind the 't' key as a global keyboard shortcut
                     this.setGlobalKeyboardShortcut( 't', this.trackListView, 'toggle' );

                     deferred.resolve({ success: true });
        }));
    });
},

/**
 * @private
 */

onVisibleTracksChanged: function() {
},


/**
 * Like <code>navigateToLocation()</code>, except it attempts to display the given
 * location with a little bit of flanking sequence to each side, if
 * possible.
 */
showRegion: function( location ) {
    var flank   = Math.round( ( location.end - location.start ) * 0.2 );
    //go to location, with some flanking region
    this.navigateToLocation({ ref: location.ref,
                               start: location.start - flank,
                               end: location.end + flank
                             });

    // if the location has a track associated with it, show it
    if( location.tracks ) {
        this.showTracks( array.map( location.tracks, function( t ) { return t && (t.label || t.name) || t; } ));
    }
},

getReferenceFeature: function( refname ) {
    return this.getStoreDeferred( 'refseqs' )
         .then( function( store ) {
                    return store.getReferenceFeatures({ name: refname, limit: 1 })
                        .first();
             });
},

/**
 * deferred.  Given a string name, search for matching feature
 * names and set the view location to any that match.
 */
searchNames: function( /**String*/ loc ) {
    var thisB = this;

    // first see if it's a reference sequence
    return this.getReferenceFeature( loc )
               .then( function( refseq ) {
                   if( refseq )
                       return { ref: refseq.get('name'), start: refseq.get('start'), end: refseq.get('end') };

                   // if not, look it up in the names index
                   return thisB._searchNameIndex( loc );
                 });
},

_searchNameIndex: function( loc ) {
    var thisB = this;
    return this.nameStore.query({ name: loc })
        .then(
            function( nameMatches ) {
                // if we have no matches, pop up a dialog saying so, and
                // do nothing more
                if( ! nameMatches.length ) {
                    new InfoDialog(
                        {
                            browser: thisB,
                            title: 'Not found',
                            content: 'Not found: <span class="locString">'+loc+'</span>',
                            className: 'notfound-dialog'
                        }).show();
                    return null;
                }

                var goingTo;

                //first check for exact case match
                for (var i = 0; i < nameMatches.length; i++) {
                    if( nameMatches[i].name  == loc )
                        goingTo = nameMatches[i];
                }
                //if no exact case match, try a case-insentitive match
                if( !goingTo ) {
                    for( i = 0; i < nameMatches.length; i++ ) {
                        if( nameMatches[i].name.toLowerCase() == loc.toLowerCase() )
                            goingTo = nameMatches[i];
                    }
                }
                //else just pick a match
                if( !goingTo ) goingTo = nameMatches[0];

                // if it has one location, go to it
                if( goingTo.location ) {
                    // go to the location
                    return goingTo.location;
                }
                // otherwise, pop up a dialog with a list of the locations to choose from
                else if( goingTo.multipleLocations ) {
                    var d = new Deferred();
                    var dialog = new LocationChoiceDialog(
                        {
                            browser: thisB,
                            locationChoices: goingTo.multipleLocations,
                            goCallback: function(loc) {
                                dialog.hide();
                                d.resolve( loc );
                            },
                            showCallback: function() {},
                            title: 'Choose '+goingTo.name+' location',
                            prompt: '"'+goingTo.name+'" is found in multiple locations.  Please choose a location to view.'
                        })
                        .show();
                    return d;
                }
                return null;
            },
            function(e) {
                console.error( e );
                new InfoDialog(
                    {
                        browser: thisB,
                        title: 'Error',
                        content: 'Error reading from name store.'
                    }).show();
                return;
            }
        );
},


/**
 * Create a global keyboard shortcut.
 * @param keychar the character of the key that is typed
 * @param [...] additional arguments passed to dojo.hitch for making the handler
 */
setGlobalKeyboardShortcut: function( keychar ) {
    // warn if redefining
    if( this.globalKeyboardShortcuts[ keychar ] )
        console.warn("WARNING: JBrowse global keyboard shortcut '"+keychar+"' redefined");

    // make the wrapped handler func
    var func = dojo.hitch.apply( dojo, Array.prototype.slice.call( arguments, 1 ) );

    // remember it
    this.globalKeyboardShortcuts[ keychar ] = func;
},

/**
 * Key event handler that implements all global keyboard shortcuts.
 */
globalKeyHandler: function( evt ) {
    // if some digit widget is focused, don't process any global keyboard shortcuts
    if( dijitFocus.curNode )
        return;

    var shortcut = this.globalKeyboardShortcuts[ evt.keyChar || String.fromCharCode( evt.charCode || evt.keyCode ) ];
    if( shortcut ) {
        shortcut.call( this );
        evt.stopPropagation();
    }
},

makeShareLink: function () {
    // don't make the link if we were explicitly configured not to
    if( !this.getConf('share_link') )
        return null;

    var browser = this;
    var shareURL = '#';

    // make the share link
    var button = new dijitButton({
            className: 'menuBarControl share',
            innerHTML: '<span class="icon"></span> Share',
            title: 'share this view',
            onClick: function() {
                URLinput.value = shareURL;
                previewLink.href = shareURL;

                sharePane.show();

                var lp = dojo.position( button.domNode );
                dojo.style( sharePane.domNode, {
                               top: (lp.y+lp.h) + 'px',
                               right: 0,
                               left: ''
                            });
                URLinput.focus();
                URLinput.select();
                copyReminder.style.display = 'block';

                return false;
            }
        }
    );

    // make the 'share' popup
    var container = dojo.create(
        'div', {
            innerHTML: 'Paste this link in <b>email</b> or <b>IM</b>'
        });
    var copyReminder = dojo.create('div', {
                                       className: 'copyReminder',
                                       innerHTML: 'Press CTRL-C to copy'
                                   });
    var URLinput = dojo.create(
        'input', {
            type: 'text',
            value: shareURL,
            size: 50,
            readonly: 'readonly',
            onclick: function() { this.select();  copyReminder.style.display = 'block'; },
            onblur: function() { copyReminder.style.display = 'none'; }
        });
    var previewLink = dojo.create('a', {
        innerHTML: 'Preview',
        target: '_blank',
        href: shareURL,
        style: { display: 'block', "float": 'right' }
    }, container );
    var sharePane = new dijitDialog(
        {
            className: 'sharePane',
            title: 'Share this view',
            draggable: false,
            content: [
                container,
                URLinput,
                copyReminder
            ],
            autofocus: false
        });

    // connect moving and track-changing events to update it
    var updateShareURL = function() {
        shareURL = browser.getConf('shareURL');
    };
    this.subscribe( '/jbrowse/v1/n/navigate',               updateShareURL );
    this.subscribe( '/jbrowse/v1/n/tracks/visibleChanged',  updateShareURL );
    this.subscribe( '/jbrowse/v1/n/globalhighlight/changed', updateShareURL );

    return button.domNode;
},


makeFullViewLink: function () {
    var thisB = this;
    // make the link
    var link = dojo.create('a', {
        className: 'topLink',
        href: window.location.href,
        target: '_blank',
        title: 'View in full-screen browser',
        innerHTML: 'Full-screen view'
    });

    // update it when the view is moved or tracks are changed
    var update_link = function() {
        link.href = thisB.getConf('shareURL');
    };
    this.subscribe( '/jbrowse/v1/n/navigate',               update_link );
    this.subscribe( '/jbrowse/v1/n/tracks/visibleChanged',  update_link );
    this.subscribe( '/jbrowse/v1/n/globalhighlight/changed', update_link );

    return link;
},

/**
 * Migrate an old location map cookie to the new format that includes timestamps.
 * @private
 */
_migrateLocMap: function( locMap ) {
    var newLoc = { "_version": 1 };
    for( var loc in locMap ) {
        newLoc[loc] = { l: locMap[loc], t: 0 };
    }
    return newLoc;
},

/**
 * Limit the size of the saved location map, removing the least recently used.
 * @private
 */
_limitLocMap: function( locMap, maxEntries ) {
    // don't do anything if the loc map has fewer than the max
    var locRefs = dojof.keys( locMap );
    if( locRefs.length <= maxEntries )
        return locMap;

    // otherwise, calculate the least recently used that we need to
    // get rid of to be under the size limit
    locMap = dojo.clone( locMap );
    var deleteLocs =
        locRefs
        .sort( function(a,b){
                   return locMap[b].t - locMap[a].t;
               })
        .slice( maxEntries-1 );

    // and delete them from the locmap
    dojo.forEach( deleteLocs, function(locRef) {
        delete locMap[locRef];
    });

    return locMap;
},

/**
 * Wrapper for dojo.cookie that namespaces our cookie names by
 * prefixing them with this.containerID.
 *
 * Has one additional bit of smarts: if an object or array is passed
 * instead of a string to set as the cookie contents, will serialize
 * it with dojo.toJson before storing.
 *
 * @param [...] same as dojo.cookie
 * @returns the new value of the cookie, same as dojo.cookie
 */
cookie: function() {
    arguments[0] = 'JBrowse-'+this.containerID + '-' + arguments[0];
    if( typeof arguments[1] == 'object' )
        arguments[1] = dojo.toJson( arguments[1] );

    var sizeLimit= this.getConf('cookieSizeLimit');
    if( arguments[1] && arguments[1].length > sizeLimit ) {
        console.warn("not setting cookie '"+arguments[0]+"', value too big ("+arguments[1].length+" > "+sizeLimit+")");
        return dojo.cookie( arguments[0] );
    }

    return dojo.cookie.apply( dojo.cookie, arguments );
},

/**
 * Return the current highlight region, or null if none.
 */
getHighlight: function() {
    return this._highlight || null;
},

/**
 * Set a new highlight.  Returns the new highlight.
 */
setHighlight: function( newHighlight ) {

    if( newHighlight && ( newHighlight instanceof Location ) )
        this._highlight = newHighlight;
    else if( newHighlight )
        this._highlight = new SimpleFeature({ data: newHighlight });

    this.publish( '/jbrowse/v1/n/globalhighlight/changed', [this._highlight] );

    return this.getHighlight();
},


_updateHighlightClearButton: function() {
    if( this._highlightClearButton ) {
        this._highlightClearButton.set( 'disabled', !!! this._highlight );
        //this._highlightClearButton.set( 'label', 'Clear highlight' + ( this._highlight ? ' - ' + this._highlight : '' ));
    }
},

getRefSeqSelectorMaxSize: function() {
    return this.getConf('refSeqSelectorMaxSize');
},

clearHighlight: function() {
    if( this._highlight ) {
        delete this._highlight;
        this.publish( '/jbrowse/v1/n/globalhighlight/changed', [] );
    }
},

setHighlightAndRedraw: function( location ) {
    var regions = [ location ];

    var oldHighlight = this.getHighlight();
    if( oldHighlight )
        regions.push( oldHighlight );

    this.setHighlight( location );
    this.publish('/jbrowse/v1/c/redrawGenomeRegions',regions);
}

});
});
