define([
           'dojo/_base/declare',
           'dojo/dom-class',

           'dijit/layout/ContentPane',

           'JBrowse/_ConfigurationMixin'
       ],
       function(
           declare,
           domClass,

           ContentPane,

           _ConfigurationMixin
       ) {

return declare( [ ContentPane, _ConfigurationMixin ], {
  region: 'top',
  baseClass: 'trackView',
  //splitter: true,
  gutters: false,

  buildRendering: function() {
      this.inherited(arguments);
      if( this.trackClass )
          domClass.add( this.domNode, this.baseClass+'-'+this.trackClass );
  },

  // a track view can have its own store, or it can use the store
  // associated with its track object
  _getStoreAttr: function() {
      return this.store || this.get('track').get('store');
  },

  heightUpdate: function(h) {
      if(! ( this.h >= h ) ) {
              this.getParent().heightUpdate( this, h );
              this.h = h;
              this.domNode.style.height = h+'px';
      }
  },

  _handleError: function(e) {
      console.error( e.stack || ''+e );
  }

});
});
