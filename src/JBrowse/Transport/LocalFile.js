define([
           'dojo/_base/declare',
           'dojo/_base/url',

           'FileSaver/FileSaver',

           'JBrowse/has',
           './_RequestBased'
       ],
       function(
           declare,
           URL,

           saveAs,

           has,
           _RequestBased
       ) {
return declare( 'JBrowse.Transport.LocalFile', _RequestBased, {

  configSchema: {
      slots: [
          { name: 'name', defaultValue: 'Local file' }
      ]
  },

  canHandle: function( def ) {
      return has('save-generated-files') && /^file:\/\//i.test( def )
          || window.Blob && def instanceof window.Blob;
  },

  _filename: function( resourceDef ) {
      if( resourceDef instanceof window.Blob )
          return resourceDef.name;

      try {
          return resourceDef.match(/^file:\/\/(.+)/i)[1];
      } catch(e) {
          throw 'invalid file url';
      }
  },

  sendFile: function( dataGenerator, destinationResourceDefinition, sendOpts ) {
      var output = '';
      if( ! sendOpts ) sendOpts = {};
      var filename = sendOpts.filename || this._filename( destinationResourceDefinition );
      var mediaType = sendOpts.mediaType;
      console.log( 'saving as type '+mediaType+', name '+filename );

      return dataGenerator
          .forEach(
              function( chunk ) {
                  output += chunk;
              },
              function() {
                  saveAs( new Blob( [output], { type: mediaType }), filename );
              }
          );
  }

});
});