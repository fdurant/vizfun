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
	$scope.checkboxModel = [];
	
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

	$scope.logPlaylists = function(i) {
	    $log.log("playlist with index=" + i + " and ID=" + $scope.playlists[i].id + " changed status: checkboxModel = ",  $scope.checkboxModel)
	};

	// List of lists. If there are N playlists, there are N elements in this list.
	$scope.playlistTracks = [];

	$scope.getPlaylistTracksByIndex = function(i) {
	    return $scope.getPlaylistTracksByID(i, $scope.playlists[i].id);
	}

	$scope.getPlaylistTracksByID = function(i,id) {
	    var getPlaylistTracks = dataService.getPlaylistTracks(id)
		.then(function (response) {
		    $scope.playlistTracks[i] = response.data;
		    $log.log("Retrieve playlist with ID=" + id);
		    $log.log("playlistTracks = ", $scope.playlistTracks)
		});
	}
	    
	$scope.graph = {
	    "nodes": [
		{
		    "id": "n0",
		    "label": "A node",
		    "x": 0,
		    "y": 0,
		    "size": 3
		},
		{
		    "id": "n1",
		    "label": "Another node",
		    "x": 3,
		    "y": 1,
		    "size": 2
		},
		{
		    "id": "n2",
		    "label": "And a last one",
		    "x": 1,
		    "y": 3,
		    "size": 1
		}
	    ],
	    "edges": [
		{
		    "id": "e0",
		    "source": "n0",
		    "target": "n1"
		},
		{
		    "id": "e1",
		    "source": "n1",
		    "target": "n2"
		},
		{
		    "id": "e2",
		    "source": "n2",
		    "target": "n0"
		}
	    ]
	};

	// Inspired by https://jsfiddle.net/6voan7k9/
	// Instantiate sigma:
	$scope.s = new sigma({
	    graph: $scope.graph,
	    container: 'graph-container'
	});

	$scope.refreshGraph = function() {
	    $scope.s.refresh();
	    $log.log("refreshed graph")
	};
	
    }])

    .service('dataService', function($http) {

	this.getPlaylists = function() {
	    return $http.get("/playlists");
	};

	this.getMe = function() {
	    return $http.get("/me");
	}

	this.getPlaylistTracks = function(playlistID) {
	    return $http.get("/playlist/" + playlistID);
	}

    });
