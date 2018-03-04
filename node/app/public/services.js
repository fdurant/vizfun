'use strict';

angular.module('musicVizFunApp')

    .service('dataService', function($http) {

	this.getPlaylists = function() {
	    return $http.get("/playlists");
	};

	this.getMe = function() {
	    return $http.get("/me");
	}

	this.getPlaylistTracks = function(playlistID, playlistOwner, offset, limit) {
	    return $http.get("/playlist/" + playlistID + "?playlistowner=" + playlistOwner + "&offset=" + offset + "&limit=" + limit + "&fields=items,next");
	}

	this.getMultipleArtists = function (listOfArtistIDs) {
	    return $http.get("/artists?aid=" + listOfArtistIDs.join(',') + "&fields=items,next");
	}

    });
