dojo.declare( 'JBrowse.Model.AutocompleteStore', null,
/**
 * @lends JBrowse.Model.AutocompleteStore
 */
{
    /**
     * @constructs
     */
    constructor: function( /**Object*/ args ) {
        if( ! args.namesTrie )
            throw "must provide a namesTrie argument";

        this.namesTrie = args.namesTrie;
    },

    // dojo.data.api.Read support

    fetch: function( /**Object*/ request ) {
        var start = request.start || 0;
        var matchLimit = Math.min( 15, Math.max(0, request.count) );
        var matchesRemaining = matchLimit;
	var scope = request.scope || dojo.global;
        var aborted = false;

        // wrap our abort function to set a flag
        request.abort = function() {
            var oldabort = request.abort || function() {};
            return function() {
                aborted = true;
                oldabort.call( scope, request );
            };
        }.call(this);

        if( ! request.store )
            request.store = this;

        var gotTree = false; // stays false if tree isn't found
        var matches = [];
        var prefix = (request.query.name || '').replace(/\*$/,'');
        this.namesTrie.mappingsFromPrefix(
            prefix,
            function(tree) {
                gotTree = true;
                // use dojo.some so that we can break out of the loop when we hit the limit
                dojo.some( tree, function(node) {
                               if( matchesRemaining-- ) {
                                   if( typeof node[0] == 'number' ) {
                                       matches.push({ name: node[0] + " options for " + node[1] });
                                   } else {
                                       matches.push({ name: node[1][0][1] });
                                   }
                               }
                               return matchesRemaining < 0;
                           });
            });

        // if we found more than the match limit
        if( matchesRemaining < 0 )
            matches.push({ name: 'More than ' + matchLimit + " matches", hitLimit: true });

        if( request.onBegin )
            request.onBegin.call( scope, matches.length, request );
        if( request.sort )
            matches.sort(dojo.data.util.sorter.createSortFunction(request.sort, this));
        if( request.onItem ) {
            dojo.forEach( matches, function( item ) {
                if( !aborted )
                    request.onItem.call( scope, item, request );
            });
        }
	if(request.onComplete && !aborted){
	    request.onComplete.call( scope, matches, request );
	}
    },

    getValue: function( i, attr, defaultValue ) {
        var v = i[attr];
        return typeof v == 'undefined' ? defaultValue : v;
    },
    getValues: function( i, attr ) {
        var a = [ i[attr] ];
        return typeof a[0] == 'undefined' ? [] : a;
    },

    getAttributes: function(item)  {
        return dojof.keys( item );
    },

    hasAttribute: function(item,attr) {
        return item.hasOwnProperty(attr);
    },

    containsValue: function(item, attribute, value) {
        return item[attribute] == value;
    },

    isItem: function(item) {
        return typeof item == 'object' && typeof item.label == 'string';
    },

    isItemLoaded: function() {
        return true;
    },

    loadItem: function( args ) {
    },

    close: function() {},

    getLabel: function(i) {
        return this.getValue(i,'name',undefined);
    },
    getLabelAttributes: function(i) {
        return ['name'];
    }
});
