define([
           'dojo/_base/declare',
           './Box'
       ],
       function(
           declare,
           BoxGlyph
       ) {

return declare([ BoxGlyph ], {
  configSchema: {
      slots: [
          { name: 'color', defaultValue: function(feature) { 
              var colourList = {
                  'gneg'   :"#FFFFFF",
                  'gpos100':"#000000",
                  'gpos75' :"#666666",
                  'gpos50' :"#B3B3B3",
                  'gpos25' :"#E5E5E5",
                  'gvar'   :"#FFFFFF",
                  'stalk'  :"#CD3333"
              }
            return colourList[feature.get('gieStain')]; 
            }
          },
          { name: 'height', defaultValue: 30, type: 'float' },
          { name: 'borderColor', defaultValue: 'black', type: 'Color' },
          { name: 'borderWidth', defaultValue: 1, type: 'float' }
      ]
  }
});
});
