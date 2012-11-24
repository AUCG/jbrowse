define( [ 'dojo/_base/declare',
          'dojo/aspect',
          'dojo/on',
          'dijit/Dialog',
          'dijit/form/ValidationTextBox',
          'dijit/form/Select',
          'dijit/form/Button',
          'dijit/form/RadioButton',
          'dojox/form/Uploader',
          'dojox/form/uploader/plugins/IFrame',
          './FileDialog/SuperFileList'
        ],
        function( declare, aspect, on, Dialog, TextBox, Select, Button, RadioButton, Uploader, ignore, FileList ) {

return declare(null,{
    constructor: function( args ) {
        this.browser = args.browser;
        this.config = dojo.clone( args.config || {} );
    },

    _remoteControls: function() {
        var inputCounter = 0;
        var id = 'remoteInput'+(inputCounter++);

        var table = dojo.create('table');
        var tr = dojo.create( 'tr', {}, table );
        dojo.create( 'label', { for: id, innerHTML: 'URL' }, dojo.create('td',{},tr) );

        var textBox = new TextBox({
            id: id,
            regExpGen: function() { return '^(https?|file):\/\/.+'; },
            onChange: function() {
                typeSelect.set(
                    'value',
                        /\.bam$/i.test(this.get('value')) ? 'bam' :
                        /\.bai$/i.test(this.get('value')) ? 'bai' :
                        /\.gff3?$/i.test(this.get('value') ) ? 'gff3' :
                        /\.(bw|bigwig)$/i.test(this.get('value') ) ? 'bigwig' :
                        null
                );
            }
        });
        textBox.placeAt( dojo.create('td',{},tr) );

        var typeSelect = new Select({
            options: [
                { label: '<span class="ghosted">file type?</span>', value: null     },
                { label: "GFF3",   value: "gff3"   },
                { label: "BigWig", value: "bigwig" },
                { label: "BAM",    value: "bam"    },
                { label: "BAI",    value: "bai"    }
            ]
        });
        typeSelect.placeAt( dojo.create('td',{},tr) );

        return table;
    },

    _localControls: function( mainContainer ) {
        var dndSupported = 'draggable' in document.createElement('span');

        var inputCounter = 0;
        var id = 'localInput'+(inputCounter++);

        var cont = dojo.create('div', {
            innerHTML: '<h2>Local files</h2>'
                       +'<h3>'
                         + (dndSupported ? 'Drag or select files to open.' : 'Select files to open.')
                         + '</h3>'
        });

        var fileBox = new dojox.form.Uploader({
            multiple: true
        });
        fileBox.placeAt( cont );
        if( dndSupported ) {
            fileBox.addDropTarget( mainContainer );
        }

        var list = new FileList({ uploader: fileBox });
        list.placeAt(cont);
        this.localFileList = list;

        return cont;
    },

    _actionBar: function() {
        var actionBar = dojo.create(
            'div', {
                className: 'dijitDialogPaneActionBar',
                innerHTML: '<div class="aux">'
                           + '<input type="radio" checked="checked" data-dojo-type="dijit.form.RadioButton" name="display" id="immediate" value="immediate"/>'
                           + '<label for="immediate">Display immediately</label>'
                           + ' <input type="radio" data-dojo-type="dijit.form.RadioButton" name="display" id="tracksOnly" value="tracksOnly"/>'
                           + '<label for="tracksOnly">Add to tracks</label>'
                           + '</div>'
            });
        new Button({ iconClass: 'dijitIconDelete', onClick: dojo.hitch( this.dialog, 'hide' ), label: 'Cancel' })
            .placeAt( actionBar );
        new Button({ iconClass: 'dijitIconFolderOpen', onClick: dojo.hitch( this.dialog, 'hide' ), label: 'Open' })
            .placeAt( actionBar );

        return actionBar;
    },

    open: function() {
        var dialog = this.dialog = new Dialog(
            { title: "Open files", className: 'fileDialog' }
            );

        dialog.set(
            'content',
            [
                this._localControls( dialog.domNode ),
                dojo.create('hr'),
                this._remoteControls(),
                this._actionBar()
            ]);
        dialog.show();

        aspect.after( dialog, 'hide', function() {
                          dialog.destroyRecursive();
                      });
    }
});
});