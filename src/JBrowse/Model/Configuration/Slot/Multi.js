/**
 * Slot that holds an array of zero or more other slots, all of the same type.
 */
define([
           'dojo/_base/declare',
           'dojo/_base/lang',
           '../Slot'
       ],
       function( declare, lang, Slot ) {
return declare( Slot, {
    constructor: function( def ) {
        this.elementType = this.type.replace(/^multi\-/i,'');
        this.elementSlot = new ( this.getSlotClass( this.elementType) )({ name: 'unnamed', type: this.elementType });
        this.types = ['array'];
    },

    normalizeValue: function( valueArray ) {
        // checks that it is an array
        valueArray = this.inherited( arguments );

        // normalize each element
        for( var i = 0; i<valueArray.length; i++ ) {
            valueArray[i] = this.elementSlot.normalizeValue( valueArray[i] );
        }

        return valueArray;
    }
});
});