'use strict';

angular.module('musicVizFunApp', [])

    .controller('MusicVizFunController', ['$scope', '$http', '$log', function($scope, $http, $log) {
	
	$scope.userIsLoggedIn = false;
	$scope.loggedInUserName = '???';
	$scope.urlOfLoggedInUserImage = 'https://hollywoodhatesme.files.wordpress.com/2012/07/invisible-man.jpg';
	
	$http.get("/me")
	    .then(function (data) {
		// HTTP returned status 200. This does not necessarily mean that the users was authenticated!
		// So let's check what's inside
		$log.log('data = ', data)
		if (data.data.body) {
		    $scope.userIsLoggedIn = true;
		    if (data.data.body.display_name) {
			$scope.loggedInUserName = data.data.body.display_name;
		    }
		    else if (data.data.body.id) {
			$scope.loggedInUserName = data.data.body.id;
		    }
		    else {
			$scope.loggedInUserName = 'FAKE NAME';
		    }

		    if (data.data.body.images && data.data.body.images[0] && data.data.body.images[0].url) {
			$scope.urlOfLoggedInUserImage = data.data.body.images[0].url
		    }
		    else {
			$scope.urlOfLoggedInUserImage = 'https://en.wikipedia.org/wiki/File:Kermit_the_Frog.jpg';
		    }

		}
		else {
		    $scope.userIsLoggedIn = false;
		    $scope.loggedInUserName = '?????';
		}

	    }, function() {
		console.log('data = ', data)
		$scope.userIsLoggedIn = false;
		$scope.loggedInUserName = '?????';
	    });
	


    }]);
