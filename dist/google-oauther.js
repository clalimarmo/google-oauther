define(function(require) {

  var AUTH_TOKEN_KEY = 'google-oauther-auth-token';

  var $ = require('jquery');

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

  singleton.run = function(_config) {
    ensureConfig(_config);

    if (singleton.isAuthenticated()) {
      fetchUserInformation();
      return;
    }

    if (!queryParams.access_token) {
      var url = OAUTH2_ENDPOINT +
        '?scope=' + scope.join(' ') +
        '&response_type=token' +
        '&redirect_uri=' + window.location.href +
        '&client_id=' + config.clientID;
      window.location = url;
    } else {
      window.localStorage.setItem(AUTH_TOKEN_KEY, queryParams.access_token);
      window.location = window.location.href.split('#')[0];
    }
  };

  singleton.reauthenticate = function() {
    setTimeout(function() {
      clearAuthToken();
      singleton.run();
    }, reauthenticateBackoff);
    increaseReauthenticateBackoff();
  };

  singleton.isAuthenticated = function() {
    return authToken() !== null;
  };

  singleton.onAuthenticate = function(callback) {
    onAuthenticateCallbacks.push(callback);
  };

  singleton.token = function() {
    return authToken();
  };

  singleton.user = function() {
    return user;
  };

  var queryParams = (function() {
    // from https://developers.google.com/accounts/docs/OAuth2UserAgent
    var params = {}, queryString = window.location.hash.substring(1),
        regex = /([^&=]+)=([^&]*)/g, match;
    match = regex.exec(queryString);
    while (match) {
      params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
      match = regex.exec(queryString);
    }
    return params;
  })();

  var authToken = function() {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  };

  var clearAuthToken = function() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  };

  var fetchUserInformation = function() {
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
        resetReauthenticateBackoff();
      },
      error: function(response) {
        if (RETRY_STATUS_CODES.indexOf(response.status) > -1) {
          singleton.reauthenticate();
        }
      },
    });
  };

  var ensureConfig = function(_config) {
    if (!config) {
      config = ensure(['scope', 'clientID'], _config);
    }
    scope = [PROFILE_SCOPE].concat(config.scope);
  };

  //constructor dependency injection helper
  var ensure = function(dependencyNames, dependencies) {
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

  var increaseReauthenticateBackoff = function() {
    reauthenticateBackoff = reauthenticateBackoff * 2;
  };

  var resetReauthenticateBackoff = function() {
    reauthenticateBackoff = 1;
  };

  return singleton;
});
