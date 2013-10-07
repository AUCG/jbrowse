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
return declare( _RequestBased, {

  name: 'File',

  canHandle: function( def ) {
      return has('save-generated-files') && /^file:\/\//.test( def )
          || window.Blob && def instanceof window.Blob;
  },

  _filename: function( resourceDef ) {
      if( resourceDef instanceof window.Blob )
          return resourceDef.name;

      var u = new URL( resourceDef );
      if( u.scheme != 'file' ) throw 'invalid url';
      return u.host + u.path;
  },

  sendFile: function( dataGenerator, destinationResourceDefinition, sendOpts ) {
      var output = '';
      if( ! sendOpts ) sendOpts = {};
      var filename = sendOpts.filename || this._filename( destinationResourceDefinition );
      var mimetype = sendOpts.format ? 'application/x-'+sendOpts.format.toLowerCase() : 'text/plain';
      console.log( 'saving as type '+mimetype+', name '+filename );

      return dataGenerator
          .forEach(
              function( chunk ) {
                  output += chunk;
              },
              function() {
                  saveAs( new Blob( [output], { type: mimetype }), filename );
              }
          );
  }

});
});