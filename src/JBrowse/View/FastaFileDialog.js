define( [
            'dojo/_base/declare',
            'JBrowse/View/FileDialog',
            './FileDialog/TrackList/FASTADriver',
            './FileDialog/TrackList/IndexedFASTADriver'
        ],
        function(
            declare,
            FileDialog,
            FASTADriver,
            IndexedFASTADriver
        ) {

return declare( FileDialog, {

    constructor: function( args ) {
        this.inherited(arguments);
        this._fileTypeDrivers = [ new FASTADriver(), new IndexedFASTADriver() ];
        return this;
    },

    

    show: function( args ) {
        args.introMsg = "Select a FASTA file (.fa) or indexed FASTA (.fa and .fai) to open";
        this.inherited(arguments);
        this.dialog.set('title','Open sequence file');
    }

   
});
});
