define([
           'dojo/_base/declare',
           'dojo/_base/lang',
           'dojo/_base/array',
           'dojo/when',
           'dojo/store/Memory',

           'JBrowse/Component',
           'JBrowse/Digest/Crc32',
           'JBrowse/Util'
       ],
       function(
           declare,
           lang,
           array,
           when,
           MemoryStore,

           Component,
           Digest,
           Util
       ) {
return declare( Component, {
  constructor: function(args) {
      this._trackCache = {};
  },

  configSchema: {
      slots: [
          { name: 'name', type: 'string', required: true },
          { name: 'stores', type: 'object', defaultValue: [] },
          { name: 'tracks', type: 'multi-object', defaultValue: [] },
          { name: 'referenceSets', type: 'multi-object', defaultValue: [] },

          { name: 'defaultReferenceSetName', type: 'string',
            defaultValue: function(hub) {
                var sets = hub.getConf('referenceSets');
                return sets && sets[0] && sets[0].name || 'default';
            },
            description: "default reference sequence set to display"
          },

          { name: 'defaultReferenceSetClass', type: 'string',
            defaultValue: 'JBrowse/Model/ReferenceSet',
            description: "default JS class to use for instantiating reference"
                         + " set objects, if they don't have a class specified"
          }
      ]
  },

  // a data hub is track configuration, reference sequences, and data
  _instantiateTrack: function( trackConf ) {
      var thisB = this;
      return this.openStore( trackConf.store )
          .then( function( store ) {
                     return Util.instantiateComponent(
                         { app: thisB.app,
                           dataHub: thisB,
                           store: store
                         },
                         trackConf,
                         'JBrowse/Track'
                     );
                 });
  },

  getTrackMetadataStore: function() {
      return this.metadataStore;
  },

  getTrack: function( trackName ) {
      return this._trackCache[ trackName ] || ( this._trackCache[trackName] = function() {
          var thisB = this;
          // get the track's record out of the metadata store, then instantiate the track object
          return this.getTrackMetadataStore()
                     .then( function( metaStore ) {
                                return when( metaStore.fetchItemByIdentity( trackName ) )
                                    .then( function( trackmeta ) {
                                               if( trackmeta && trackmeta.config )
                                                   return thisB._instantiateTrack( trackmeta.config );
                                               else {
                                                   console.warn( 'track "%s" not found in data hub "%s"',
                                                                 trackName, thisB.getConf('name') );
                                                   return undefined;
                                               }
                                           });
                            });
      }.call(this));
  },

  getReferenceSet: function( name ) {
      if( ! this._refSets ) this._refSets = {};
      if( name == 'default' )
          name = this.getConf('defaultReferenceSetName');

      return this._refSets[name] || ( this._refSets[name] = function() {
          // find the ref set's conf
          var conf;
          array.some( this.getConf('referenceSets'), function(c) {
              return ( c.name == name ) ? ( conf = c ) : false;
          });
          if( ! conf ) return Util.resolved(undefined);
          conf = lang.mixin( {}, conf, { dataHub: this, browser: this.browser } );

          // instantiate the ref set
          var thisB = this;
          if( conf.store )
              return this.openStore( conf.store )
                  .then( function( store ) {
                        return Util.instantiate(
                            conf.type || thisB.getConf('defaultReferenceSetClass'),
                            lang.mixin({},conf,{store:store})
                        );
                   });
          else
              return Util.instantiate(
                  conf.type || thisB.getConf('defaultReferenceSetClass'),
                  conf
              );

      }.call(this));
  },

  getStore: function( storeName ) {
      return this.openStore( storeName );
  },

  // given a store name or store configuration, return a Deferred
  // store object for it.  if a store name, the store must be for data
  // in this data hub.
  openStore: function( storeNameOrConf ) {
      this._storeCache   = this._storeCache || {};
      this._storeClasses = this._storeClasses || {};

      var conf, storeName;
      if( ! storeNameOrConf ) {
          return Util.resolved(undefined);
      }
      else if( typeof storeNameOrConf !== 'string' ) {
          conf = storeNameOrConf;
          storeName = 'store'+Digest.objectFingerprint( conf );
      }
      else {
          storeName = storeNameOrConf;
          conf = this.getConf('stores')[ storeName ];
      }

      return this._storeCache[ storeName ] || ( this._storeCache[ storeName ] = function() {

          if( ! conf )
              throw new Error( "store '"+storeName+"' not found" );

          var storeClassName = conf.type;
          if( ! storeClassName )
              throw new Error( "store "+storeName+" has no type defined" );

          var thisB = this;
          return (
              this._storeClasses[storeClassName]
                  || ( this._storeClasses[storeClassName] = Util.loadJSClass(storeClassName) )
          ).then(function( storeClass ) {
                     return new storeClass({ browser: thisB.browser, config: conf, dataHub: thisB });
                 });
      }.call(this));
  },

  /**
   * Add a store configuration to the data hub.  If name is falsy or
   * missing, will autogenerate one.
   */
   uniqCounter: 0,
   addStoreConfig: function( /**String*/ name, /**Object*/ storeConfig ) {
       name = name || 'addedStore'+this.uniqCounter++;

       if( ! this._storeCache )
           this._storeCache = {};

       if( this.getConf('stores')[name] || this._storeCache[name] ) {
           throw "store "+name+" already exists!";
       }

       this.getConf('stores')[name] = storeConfig;
       return name;
   },

   /**
    * Get a dojo.store object that can be used to connect this hub's
    * metadata to dijit widgets.
    */
   getDojoStore: function() {
       var metadata = [{ id: '__ROOT', name: this.getConf('name') }];

       var stores = this.getConf('stores');
       var storeArray = [];
       for( var storename in stores ) {
           storeArray.push( [storename,stores[storename]] );
       }
       if( storeArray.length ) {
           metadata.push( { id: '__STORES', name: 'Stores', parent: '__ROOT' });
           array.forEach( storeArray, function( s ) {
               metadata.push({ id: s[0], name: s[0], type: 'store', parent: '__STORES', conf: s[1] });
           });
       }

       var tracks = this.getConf('tracks');
       if( tracks.length ) {
           metadata.push( { id: '__TRACKS', name: 'Tracks', parent: '__ROOT' });
           array.forEach( tracks, function( t ) {
               metadata.push({ id: t.name, name: t.name, type: 'track', parent: '__TRACKS', conf: t });
           });
       }

       var refSets = this.getConf('referenceSets');
       if( refSets.length ) {
           metadata.push( { id: '__REFSETS', name: 'Reference Sets', parent: '__ROOT' });
           array.forEach( refSets, function( r ) {
               metadata.push({ id: r.name, name: r.name, type: 'refset', parent: '__REFSETS', conf: r });
           });
       }

       return new MemoryStore({
           data: metadata,
           getChildren: function( obj ) {
               return this.query({parent: obj.id});
           }
       });
   }

// /**
//  * Replace existing track configurations.
//  * @private
//  */
// _replaceTrackConfigs: function( /**Array*/ newConfigs ) {
//     if( ! this.trackConfigsByName )
//         this.trackConfigsByName = {};

//     array.forEach( newConfigs, function( conf ) {
//         if( ! this.trackConfigsByName[ conf.label ] ) {
//             console.warn("track with label "+conf.label+" does not exist yet.  creating a new one.");
//         }

//         this.trackConfigsByName[conf.label] =
//                            dojo.mixin( this.trackConfigsByName[ conf.label ] || {}, conf );
//    },this);
// },
// /**
//  * Delete existing track configs.
//  * @private
//  */
// _deleteTrackConfigs: function( configsToDelete ) {
//     // remove from this.config.tracks
//     this.config.tracks = array.filter( this.config.tracks || [], function( conf ) {
//         return ! array.some( configsToDelete, function( toDelete ) {
//             return toDelete.label == conf.label;
//         });
//     });

//     // remove from trackConfigsByName
//     array.forEach( configsToDelete, function( toDelete ) {
//         if( ! this.trackConfigsByName[ toDelete.label ] ) {
//             console.warn( "track "+toDelete.label+" does not exist, cannot delete" );
//             return;
//         }

//         delete this.trackConfigsByName[ toDelete.label ];
//     },this);
// },

});
});