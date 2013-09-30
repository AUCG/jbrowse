define([
           'dojo/_base/declare',
           'dojo/_base/array',
           'dojo/Deferred',
           'dojo/io-query',
           'dojo/on',

           'JBrowse/Auth/CredentialSlot',
           'JBrowse/Errors',
           'JBrowse/Util',
           'JBrowse/Auth/OAuth2/Token',
           'JBrowse/Auth/OAuth2/TokenStore'
       ],
       function(
           declare,
           array,
           Deferred,
           ioQuery,
           on,

           CredentialSlot,
           Errors,
           Util,
           Token,
           TokenStore
       ) {

var knownScopes = {
    drive: 'https://www.googleapis.com/auth/drive'
};

return declare( CredentialSlot, {

  configSchema: {
     slots: [
         { name: 'name', defaultValue: 'Google' },
         { name: 'urlRegExp', defaultValue: 'https?://[^/]*.?google.com/' },

         { name: 'authStartURL', type: 'string',
           description: 'Interactive web page used to start the OAuth2 authentication process.  Opened in a poopup window.',
           defaultValue: 'https://accounts.google.com/o/oauth2/auth'
         },
         { name: 'tokenValidateURL', type: 'string',
           description: 'REST service URL used to validate auth tokens',
           defaultValue: 'https://www.googleapis.com/oauth2/v1/tokeninfo'
         },
         { name: 'clientID', type: 'string',
           description: 'OAuth2 client ID for this JBrowse installation',
           required: true,
           defaultValue: '506915665486-mlc9gh1gr973vprppl4cu0ohdoh2nuq0.apps.googleusercontent.com'
         },
         { name: 'defaultScopes', type: 'multi-string',
           description: 'set of authentication scopes to ask for by default',
           defaultValue: [ knownScopes.drive ]
         },

         { name: 'authWindowOpts', type: 'multi-string',
           description: 'array of [name,options] to use when instantiating the authentication window',
           defaultValue: function( slot ) {
               return [ slot.getConf('name')+'AuthWindow', 'status=no,toolbar=no,width=400,height=400' ];
           }
         }

     ]
  },

  constructor: function() {
      this._tokenStore = new TokenStore({ credentialSlot: this });
  },

  neededFor: function( resourceDef ) {
      var scopes = this._scopesForResource( resourceDef );
      return !!( scopes && scopes.length );
  },

  decorateHTTPRequest: function(req) {
      var bearer = array.map( this._tokensForResource( req ), function(tok) {
                                  return 'Bearer '+tok;
                              }).join(';');

      if( ! req.headers )
          req.headers = {};
      if(! req.headers.Authorization )
          req.headers.Authorization = bearer;
      else
          req.headers.Authorization += ';'+bearer;
 },

  _getCredentials: function( opts ) {
      var thisB = this;

      // see if we can figure out from the opts what scopes we really need
      var scopes = opts.url && this._scopesForResource( opts ) || [];
      // if all the scopes we need for this request are in the
      // defaultScopes, just go ahead and ask for the default set
      var defaultScopes = this.getConf('defaultScopes');
      if( array.every( scopes, function(scope) { return array.indexOf( defaultScopes, scope ) >= 0; } ) )
          scopes = defaultScopes;

      console.log( scopes.length+' scopes: '+scopes.join(' ') );

      if( ! scopes.length )
          return Util.resolved( [] );

      return this._getTokensForScopes( scopes );
  },

  _getTokensForScopes: function( scopes ) {
      return this._tokenStore.getAccessTokensForScopes( scopes );
  },

  /**
   * Get a new access token for the given scopes.  Will be called by
   * the tokenstore if it needs more tokens to satisfy the given
   * scopes.
   */
  _getNewToken: function( scopes ) {
      var authUrl = this.getConf('authStartURL') + '?' + ioQuery.objectToQuery(
          {
              response_type:  'token',
              client_id:      this.getConf('clientID'),
              scope:          scopes.join(' '),
              redirect_uri:   Util.resolveUrl( ''+window.location, 'themes/blank.html' )
              // TODO: set login_hint here if credentials are stored
          });

      var thisB = this;

      return this._getTokenData( authUrl )
          .then( function( tokenData ) {
                     var tokenString = tokenData.access_token;
                     if( ! tokenString )
                         throw new Error('Could not find token in token data', tokenData );
                     delete tokenData.access_token;
                     return thisB._createAndValidateToken( tokenString, tokenData );
                 });
  },

  /**
   * open the auth window and get the token from its URL when it's ready.
   * returns deferred plain object of token data
   */
  _getTokenData: function( authUrl ) {
      var thisB = this;
      var d = new Deferred();

      var authWindow = window.open.apply( window, [authUrl].concat( this.getConf('authWindowOpts') ) );
      if( ! authWindow )
          throw new Error( "Could not open popup window to do "+this.getConf('name')+' authentication.  Is a popup blocker active?' );
      var tokenData;

      // set up an interval to detect if the window is closed without
      // completing auth.  can't use on() for this, because the window
      // might not be open in the same domain as us, and the browser
      // won't give us the events
      var closePoll = window.setInterval(
          function() {
              if( authWindow.closed && ! tokenData )
                  d.reject( new Error( 'Authentication failed' ) );
          }, 400 );
      d.then( null, function(e) { window.clearInterval( closePoll ); throw e; });

      // if we get a load event from the window, it must have gotten
      // to our redirect URL and should have a token for us in its URL
      on.once( authWindow, 'load', function() {
          try {
              tokenData = thisB._parseCredentials( authWindow );
              if( ! tokenData )
                  return;
              authWindow.close();

              if( tokenData.error )
                  d.reject( tokenData.error );
              else
                  d.resolve( tokenData );
          } catch(e) {
              d.reject(e);
          };
      });

      return d;
  },

  _createAndValidateToken: function( tokenString, metaData ) {
      var thisB = this;
      var resourceDef = {
          url: this.getConf('tokenValidateURL'),
          method: 'get',
          query: { access_token: tokenString },
          handleAs: 'json'
      };

      return this.browser.getTransportForResource( resourceDef )
          .fetch( resourceDef )
          .then( function( response ) {
                  if( response.error )
                      throw new Error( response.error );

                  // check `audience`; critical for security
                  var audience = response.audience || response.issued_to;
                  if( audience != thisB.getConf('clientID') )
                      throw new Error( 'Authentication token is for the wrong Client ID.' );

                  return new Token( tokenString, response );
              });
  },

  _parseCredentials: function( authWindow ) {
      if( ! /access_token=/.test( authWindow.location.hash ) )
          return null;

      // the credentials are in the #fragment of the authWindow's URL
      var fragment = authWindow.location.hash.replace(/^#/,'');
      return ioQuery.queryToObject( fragment );
  },

  _tokensForResource: function( req ) {
      var scopes = this._scopesForResource( req );
      return scopes && scopes.length ? this._getTokensForScopes( scopes ) : [];
  },

  _scopesForResource: function( resourceDef ) {
      var scopes = [];
      if( /^google\-drive:/.test( resourceDef.url ) ) {
          scopes.push( knownScopes.drive );
      }
      return scopes;
  }

});
});