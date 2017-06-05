'use strict';

angular.module('musicVizFunApp', [])

    .controller('MusicVizFunController', ['$scope', function($scope) {

	$scope.urlOfLoggedInUserImage = 'https://hollywoodhatesme.files.wordpress.com/2012/07/invisible-man.jpg';
	$scope.loggedInUserName = '???';
	
    }]);
