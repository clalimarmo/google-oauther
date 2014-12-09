define(function(require) {

  var $ = require('jquery');

  var queryParams = function() {
    // from https://developers.google.com/accounts/docs/OAuth2UserAgent
    var params = {}, queryString = window.location.hash.substring(1),
        regex = /([^&=]+)=([^&]*)/g, match;
    match = regex.exec(queryString);
    while (match) {
      params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
      match = regex.exec(queryString);
    }
    return params;
  }

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

  var OAUTH2_ENDPOINT = 'https://accounts.google.com/o/oauth2/auth';
  var PROFILE_ENDPOINT = 'https://www.googleapis.com/plus/v1/people/me';
  var PROFILE_SCOPE = 'profile';

  var token;
  var user;
  var onAuthenticateCallbacks = [];

  var singleton = {};
  var scope;

  var fetchUserInformation = function() {
    $.ajax({
      url: PROFILE_ENDPOINT + '?access_token=' + token,
      success: function(data) {
        user = {
          id: data.id,
          displayName: data.displayName,
          image: data.image,
        };
        for (var i = 0; i < onAuthenticateCallbacks.length; i++) {
          onAuthenticateCallbacks[i](singleton);
        }
      },
    });
  };

  // callback for popup - save token and get user info
  window.authenticatedWith = function(_token) {
    token = _token;
    fetchUserInformation();
  };

  singleton.run = function(_config) {
    ensure(['scope', 'clientID'], _config);

    var config = _config;
    scope = [PROFILE_SCOPE].concat(config.scope);

    if (!queryParams.access_token) {
      var url = OAUTH2_ENDPOINT +
        '?scope=' + scope.join(' ') +
        '&response_type=token'
        '&redirect_uri=' + window.location.href +
        '&client_id=' + config.clientID;
      window.open(url, 'oauth', 'top=200,left=200,height=400,width=600');
    } else {
      window.opener.authenticatedWith(queryParams.access_token);
      window.close();
    }
  };

  singleton.isAuthenticated = function() {
    return token !== undefined;
  };

  singleton.onAuthenticate = function(callback) {
    onAuthenticateCallbacks.push(callback);
  };

  singleton.token = function() {
    return token;
  };

  singleton.user = function() {
    return user;
  };

  return singleton;
});
