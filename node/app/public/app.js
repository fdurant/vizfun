'use strict';

angular.module('musicVizFunApp', [])

    // Inspired by https://stackoverflow.com/questions/18880737/how-do-i-use-rootscope-in-angular-to-store-variables
    .run(function($rootScope) {
	$rootScope.userIsLoggedIn = null;
	$rootScope.loggedInUserName = null;
    })

    .controller('LoginController', ['$scope', '$rootScope', '$http', '$log', 'dataService', function($scope, $rootScope, $http, $log, dataService) {
	
	$scope.userIsLoggedIn = false;
	$scope.loggedInUserName = '???';
	$scope.urlOfLoggedInUserImage = 'https://hollywoodhatesme.files.wordpress.com/2012/07/invisible-man.jpg';
	
	$scope.me = dataService.getMe()
	    .then(function (data) {
		// HTTP returned status 200. This does not necessarily mean that the users was authenticated!
		// So let's check what's inside
		$log.log('data = ', data)
		if (data.data.body) {
		    $log.log('data.data.body exists');
		    $log.log('$rootScope.userIsLoggedIn = ' , $rootScope.userIsLoggedIn);
		    $scope.userIsLoggedIn = true;
		    $rootScope.userIsLoggedIn = $scope.userIsLoggedIn;
		    $log.log('$rootScope.userIsLoggedIn = ' , $rootScope.userIsLoggedIn);
		    if (data.data.body.display_name) {
			$log.log('data.data.body.display_name exists');
			$scope.loggedInUserName = data.data.body.display_name;
			$rootScope.loggedInUserName = $scope.loggedInUserName;
		    }
		    else if (data.data.body.id) {
			$log.log('data.data.body.id exists');
			$scope.loggedInUserName = data.data.body.id;
			$rootScope.loggedInUserName = $scope.loggedInUserName;
		    }
		    else {
			$log.log('none of data.data.body.* exist');
			$scope.loggedInUserName = 'FAKE NAME';
			$rootScope.loggedInUserName = $scope.loggedInUserName;
		    }
		    
		    if (data.data.body.images && data.data.body.images[0] && data.data.body.images[0].url) {
			$scope.urlOfLoggedInUserImage = data.data.body.images[0].url
		    }
		    else {
			$scope.urlOfLoggedInUserImage = 'https://en.wikipedia.org/wiki/File:Kermit_the_Frog.jpg';
		    }
		    
		}
		else {
		    $log.log('data.data.body does not exist');
		    $scope.userIsLoggedIn = false;
		    $rootScope.userIsLoggedIn = $scope.userIsLoggedIn;
		    $scope.loggedInUserName = '?????';
		    $rootScope.loggedInUserName = $scope.loggedInUserName;
		}
	    }, function() {
		$log.log('data = ', data)
		$scope.userIsLoggedIn = false;
		$rootScope.userIsLoggedIn = $scope.userIsLoggedIn;
		$scope.loggedInUserName = '?????';
		$rootScope.loggedInUserName = $scope.loggedInUserName;
	    });
	
    }])

    .controller('PlaylistController', ['$scope', '$rootScope', '$http', '$log', '$timeout', 'dataService', function($scope, $rootScope, $http, $log, $timeout, dataService) {
	
	$scope.playlists = [];

	// Inspired by https://docs.angularjs.org/api/ng/input/input%5Bcheckbox%5D
	$scope.checboxModel = [];
	
	// Only start retrieving the playlists when the user has successfully logged in
	$scope.$watch(function() {return $rootScope.userIsLoggedIn},
		      function(newValue, oldValue) {
			  $log.log('$rootScope.userIsLoggedIn value was: ' + oldValue +' and now is: ' + newValue);
			  if (newValue) {
			      $log.log('Retrieving playlists');
			      $scope.getPlaylists = dataService.getPlaylists()
				  .then(function (response) {
				      $scope.playlists = response.data;
				      $scope.checkboxModel = Array($scope.playlists.length).fill(true)
				      $log.log("playlists = ", $scope.playlists)
				  });
			  }
			  else {
			      $log.log('Not retrieving playlists');
			  }
		      });
	
    }])

    .service('dataService', function($http) {

	this.getPlaylists = function() {
	    return $http.get("/playlists");
	};

	this.getMe = function() {
	    return $http.get("/me");
	}

    });
