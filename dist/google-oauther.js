define(function(require) {

  var AUTH_TOKEN_KEY = 'google-oauther-auth-token';
  var AUTH_TOKEN_EXPIRATION_KEY = 'google-oauther-auth-expiration';

  var $ = require('jquery');

  // consider the token expired 1 minute before it actually is, by default
  var DEFAULT_TOKEN_EXPIRATION_BUFFER = 60 * 1000;

  var OAUTH2_ENDPOINT = 'https://accounts.google.com/o/oauth2/auth';
  var PROFILE_ENDPOINT = 'https://www.googleapis.com/plus/v1/people/me';
  var PROFILE_SCOPE = 'profile';

  var STATUS_CODE_UNAUTHORIZED = 401;
  var STATUS_CODE_FORBIDDEN = 403;

  var RETRY_STATUS_CODES = [
    STATUS_CODE_UNAUTHORIZED,
    STATUS_CODE_FORBIDDEN
  ];

  var user;
  var onAuthenticateCallbacks = [];

  var singleton = {};
  var scope;
  var config;
  var reauthenticateBackoff = 1;
  var queryParams = getQueryParams();

  singleton.run = function(_config, done) {
    ensureConfig(_config);

    if (singleton.isAuthenticated()) {
      fetchUserInformation(done);
      return;
    }

    if (!queryParams.access_token) {
      var url = OAUTH2_ENDPOINT +
        '?scope=' + scope.join(' ') +
        '&response_type=token' +
        '&redirect_uri=' + window.location.href.split('#')[0] +
        '&client_id=' + config.clientID;

      if (locationHash().length > 0) {
        url += '&state=' +
          '{"locationHash":"' + locationHash() + '"}';
      }

      window.location = url;
    } else {
      setAuthToken(queryParams.access_token, queryParams.expires_in);
      var state;
      if (queryParams.state) {
        state = JSON.parse(queryParams.state);
      }
      var stateLocationHash = '';
      if (state && state.locationHash) {
        stateLocationHash = state.locationHash;
      }
      window.location = window.location.href.split('#')[0] + '#' + stateLocationHash;
      window.location.reload();
    }
  };

  singleton.reauthenticate = function(done) {
    setTimeout(function() {
      clearAuthToken();
      singleton.run(null, done);
    }, reauthenticateBackoff);
    increaseReauthenticateBackoff();
  };

  singleton.isAuthenticated = function() {
    return authToken() !== null && !singleton.tokenIsExpired();
  };

  singleton.onAuthenticate = function(callback) {
    onAuthenticateCallbacks.push(callback);
  };

  singleton.token = function() {
    return authToken();
  };

  singleton.tokenIsExpired = function() {
    var expirationBuffer = config.tokenExpirationBuffer || DEFAULT_TOKEN_EXPIRATION_BUFFER;
    var expiration = parseInt(window.localStorage.getItem(AUTH_TOKEN_EXPIRATION_KEY)) - expirationBuffer;
    return (new Date()).getTime() >= expiration;
  };

  singleton.user = function() {
    return user;
  };

  function authToken() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  };

  function setAuthToken(newToken, secondsBeforeExpiration) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, queryParams.access_token);

    var expiration = (new Date()).getTime() + secondsBeforeExpiration * 1000;
    window.localStorage.setItem(AUTH_TOKEN_EXPIRATION_KEY, expiration);
  };

  function clearAuthToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_TOKEN_EXPIRATION_KEY);
  };

  function locationHash() {
    return window.location.hash.replace('#', '') || '';
  };

  function fetchUserInformation(done) {
    $.ajax({
      url: PROFILE_ENDPOINT + '?access_token=' + authToken(),
      success: function(data) {
        user = {
          id: data.id,
          displayName: data.displayName,
          image: data.image,
        };
        for (var i = 0; i < onAuthenticateCallbacks.length; i++) {
          onAuthenticateCallbacks[i](singleton);
        }
        if (done instanceof Function) {
          done();
        }
        resetReauthenticateBackoff();
      },
      error: function(response) {
        if (RETRY_STATUS_CODES.indexOf(response.status) > -1) {
          singleton.reauthenticate();
        }
      },
    });
  };

  function ensureConfig(_config) {
    if (!config) {
      config = ensure(['scope', 'clientID'], _config);
    }
    scope = [PROFILE_SCOPE].concat(config.scope);
  };

  //constructor dependency injection helper
  function ensure(dependencyNames, dependencies) {
    var onlyDependencies = {};
    for (var i = 0; i < dependencyNames.length; i++) {
      var expectedDependency = dependencyNames[i];
      var injectedDependency = dependencies[expectedDependency];
      if (injectedDependency === undefined || injectedDependency === null) {
        throw new Error('missing dependency:' + expectedDependency);
      } else {
        onlyDependencies[expectedDependency] = injectedDependency;
      }
    }
    return onlyDependencies;
  };

  function increaseReauthenticateBackoff() {
    reauthenticateBackoff = reauthenticateBackoff * 2;
  };

  function resetReauthenticateBackoff() {
    reauthenticateBackoff = 1;
  }

  function getQueryParams() {
    // from https://developers.google.com/accounts/docs/OAuth2UserAgent
    var params = {}, queryString = window.location.hash.substring(1),
    regex = /([^&=]+)=([^&]*)/g, match;
    match = regex.exec(queryString);
    while (match) {
      params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
      match = regex.exec(queryString);
    }
    return params;
  };

  return singleton;
});
