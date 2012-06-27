define(['dojo/_base/declare'], function(declare) {
    return declare( 'JBrowse.Finisher', {
        constructor: function(fun) {
            this.fun = fun;
            this.count = 0;
        },
        inc: function() {
            this.count++;
        },
        dec: function() {
            this.count--;
            this.finish();
        },
        finish: function() {
            if (this.count <= 0)
                this.fun();
        }
    });
});
