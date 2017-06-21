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
	$scope.urlOfLoggedInUserImage = '/images/invisible-man.jpg';
	
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

	// We will be watching this variable for synchronization purposes
	$scope.firstPlaylistHasBeenFullyDownloaded = false;
	
	// List of strings
	$scope.playlists = [];
	// List of lists. If there are N playlists, there are N elements in this list.
	$scope.playlistTracks = [];
	// List of sets. If there are N playlists, there are N elements in this list.
	$scope.playlistArtistIDs = [];

	// Tracks and artists from playlists, accessible by ID
	$scope.playlistTracksByIDs = {};
	$scope.playlistArtistsByIDs = {};

	// Keeps track of the currently selected artist
	$scope.currentArtistID = null;
	$scope.currentArtistTrackIDs = [];

	// Regulates the buttons next to the current artist's tracks
	$scope.showPlayButtonForTrack = []; // List of booleans 
	$scope.showPlayingButtonForTrack = []; // List of booleans 
	$scope.showStopButtonForTrack = []; // List of booleans
	$scope.trackIsPlaying = []; // List of booleans
	
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
				      $scope.playlists = response.data.items;
				      $scope.checkboxModel = Array($scope.playlists.length).fill(false)
				      for (var c=0; c<$scope.playlists.length; c++) { 
					  if (c==0) {
					      $scope.checkboxModel[c] = true;
					  }
					  // Initialize
					  $scope.playlistTracks[c] = [];
					  $scope.playlistArtistIDs[c] = new Set();
				      }
				      $log.log("playlists = ", $scope.playlists)
				  });
			  }
			  else {
			      $log.log('Not retrieving playlists');
			  }
		      });

	$scope.getPlaylistTracksByIndex = function(i) {
	    // Keeping this number very moderate, so that we can get all artists for these tracks in one single batch
	    // (see variable batchOfArtistsIDs further below)
	    var nrTracksPerDownload = 50
	    return $scope.getPlaylistTracksByID(i, $scope.playlists[i].id,0,nrTracksPerDownload);
	}

	$scope.getPlaylistTracksByID = function(i,id,offset,increment) {
	    var getPlaylistTracks = dataService.getPlaylistTracks(id,offset,increment)
		.then(function (response) {

		    // Extend lists of playtracks
		    $scope.playlistTracks[i].push.apply($scope.playlistTracks[i],response.data.items);
		    $log.log("Retrieved playlist with ID=" + id);
		    $log.log("playlistTracks[" + i + "] = ", $scope.playlistTracks[i]);

		    // Assemble artistIDs for current batch of tracks
		    var batchOfArtistsIDs = new Set();
		    for (var j=0; j<response.data.items.length; j++) {
			// Store each track for direct search by its ID
//			$log.log("Adding '" + response.data.items[j].track.name + "' to playlistTracksByIDs")
			$scope.playlistTracksByIDs[response.data.items[j].track.id] = response.data.items[j];
			// There can be more than one artist per track
			if (response.data.items[j].track && response.data.items[j].track.artists) {
			    for (var a=0; a<response.data.items[j].track.artists.length; a++) {
				var artistID = response.data.items[j].track.artists[a].id;
				$scope.playlistArtistIDs[i].add(artistID);
				batchOfArtistsIDs.add(artistID);
			    }
			}
		    }

		    $scope.getMultipleArtists(i,Array.from(batchOfArtistsIDs));
		    
		    $log.log("playlistArtistIDs[" + i + "] = ", $scope.playlistArtistIDs[i]);
		    $log.log("playlistTracksByIDs = ", $scope.playlistTracksByIDs);
		    if (response.data.next) {
			// There's more => recursive call
			$scope.getPlaylistTracksByID(i,id,offset+increment,increment);
		    }
		    
		});
	}

	$scope.getMultipleArtists = function(i,listOfArtistIDs) {
	    var getMultipleArtists = dataService.getMultipleArtists(listOfArtistIDs)
		.then(function (response) {
		    if (response.data.artists) {
			for (var a=0; a<response.data.artists.length; a++) {
			    var artistID = response.data.artists[a].id;
//			    $log.log("Adding artist with artistID = " + artistID + " (" + response.data.artists[a].name + ") to playlistArtistsByIDs")
			    $scope.playlistArtistsByIDs[artistID] = response.data.artists[a];
			}
		    }
		    if (i == 0) {
			$scope.firstPlaylistHasBeenFullyDownloaded= true;
		    }

		});
	};


	$scope.updateAfterPlaylistStatusChange = function(playlistIndex) {
	    $log.log("playlist with index=" + playlistIndex + " and ID=" + $scope.playlists[playlistIndex].id + " changed status: checkboxModel = ",  $scope.checkboxModel);
	    if ($scope.checkboxModel[playlistIndex]) {
		// Activate
		$scope.addPlaylistArtistsToGraph(playlistIndex);
		$scope.addPlaylistTracksToGraph(playlistIndex);
	    }
	    else {
		// Remove
		$log.log("Removing all elements from playlist with index = " + playlistIndex);
		$scope.cy.filter(function(ele,i,eles){
		    return ele.data('playlist_index') == playlistIndex;
		}).remove();
		$scope.currentArtistID = null;
		$scope.currentArtistTrackIDs = [];
		$scope.cy.layout({name:'random'}).run();
		$scope.cy.resize();
	    }
	};

	$scope.graphStyle = [
	    {
		selector: 'node',
		style: {
//		    shape: 'hexagon',
		    'background-color': 'red',
		    'background-image': 'data(img_url)',
		    'background-fit': 'cover',
		    label: 'data(name)'
		}
	    }];
	
	$scope.cy = null;

	$scope.initializeGraph = function(playlistIndex) {
	    $scope.cy = cytoscape({
		container:document.getElementById('cy'),
		elements: [],
		layout: {name: 'random'},
		style: $scope.graphStyle
	    });
	}

	$scope.addPlaylistArtistsToGraph = function(playlistIndex) {
	    $log.log("Start running $scope.addPlaylistArtistsToGraph")
	    var l = Array.from($scope.playlistArtistIDs[playlistIndex]);
	    $log.log("l = ", l)
	    for (var j = 0; j<l.length; j++) {
		var artistID = l[j];
//		$log.log("Adding artist with ID = " + artistID + " to graph", $scope.playlistArtistsByIDs);
		if ($scope.playlistArtistsByIDs[artistID]
		    && $scope.playlistArtistsByIDs[artistID].id
		    &&$scope.playlistArtistsByIDs[artistID].name) {
		    var data = {id: $scope.playlistArtistsByIDs[artistID].id,
				playlist_index: playlistIndex,
				trackIDs: [], // To be filled in later
				name: $scope.playlistArtistsByIDs[artistID].name};
		    if ($scope.playlistArtistsByIDs[artistID].images[0]) {
			data['img_url'] = $scope.playlistArtistsByIDs[artistID].images[0].url;
			data['img_width'] = $scope.playlistArtistsByIDs[artistID].images[0].width;
			data['img_height'] = $scope.playlistArtistsByIDs[artistID].images[0].height;
		    }
		    else {
			data['img_url'] = '/images/invisible-man.jpg';
		    }
		    // TO DO: CHECK IF THE NODE ALREADY EXISTS (FROM ANOTHER PLAYLIST) BEFORE CREATING IT
		    var existing = $scope.cy.filter(function(ele,i) {
			if (ele.isNode() && ele.data("id") == $scope.playlistArtistsByIDs[artistID].id) {
			    return true;
			}
			return false;
		    });
		    if (existing.length > 0) {
			// Node already exists (from another playlist)
			$log.log("Artist node with ID = " + $scope.playlistArtistsByIDs[artistID].id + " already exists");
		    }
		    else {
			$scope.cy.add({data: data}).on('tap', function(evt) {
			    var thisArtistID = this.data().id;
			    var thisArtistTrackIDs = this.data().trackIDs;
			    // https://stackoverflow.com/questions/38673700/putting-scope-in-cytoscape-click-event
			    // updating an Angular model from outside Angular requires a manual trigger
			    $scope.$apply(function(){
				$scope.currentArtistID = thisArtistID;
				$scope.currentArtistTrackIDs = thisArtistTrackIDs;
			    });
			    $log.log('Tapped ', this.data().name, this.data().id, this.data().trackIDs);
			});
		    }
		}

	    }
	    $scope.cy.viewport({zoom: 1,
				pan: {x:100, y:100}});
	    $scope.cy.layout({name: 'random'}).run();
	    $scope.cy.resize();
	    $log.log("Done running $scope.addPlaylistArtistsToGraph for playlist with index = " + playlistIndex);
	}

	$scope.$watch(function() {return $scope.firstPlaylistHasBeenFullyDownloaded},
		      function(newValue, oldValue) {
			  $log.log('$scope.firstPlaylistHasBeenFullyDownloaded value was: ' + oldValue +' and now is: ' + newValue);
			  if (newValue) {
			      $scope.initializeGraph(0);
			      $scope.addPlaylistArtistsToGraph(0);
			      $scope.addPlaylistTracksToGraph(0);
			  }
		      });

	$scope.addPlaylistTracksToGraph = function(playlistIndex) {
	    $log.log("Start running $scope.addPlaylistTracksToGraph")
	    var l = Array.from($scope.playlistTracks[playlistIndex]);
	    $log.log("l = ", l)
	    for (var t = 0; t<l.length; t++) {
		var track = l[t].track;
		if (track.artists && track.id) {
		    for (var a=0; a<track.artists.length; a++) {
			var artistID = track.artists[a].id;
//			$log.log("Adding trackID " + track.id + " to artistID " + artistID);
			// Get the artist's existing node, and add the track ID to the data
			var artistNode = $scope.cy.filter(function(ele,i) {
			    if (ele.isNode() && ele.data("id") == artistID) {
				return true;
			    }
			    return false;
			});
			if (artistNode.length > 0) {
			    artistNode.data().trackIDs.push(track.id);
			}
			else {
			    // Weird
			    $log.log("Could not find artistID " + artistID + " for track '" + track.name + "'" )
			}
		    }
		}
	    }
	    $log.log("Done running $scope.addPlaylistTracksToGraph")
	}

	$scope.refreshGraph = function() {
	    $scope.cy.layout({name: 'random'}).run();
	    $scope.cy.resize();
	    $log.log("refreshed graph")
	};

	$scope.initializeTrackButtons = function(trackIndex) {
	    $scope.showPlayButtonForTrack[trackIndex] = false; // List of booleans 
	    $scope.showPlayingButtonForTrack[trackIndex] = false; // List of booleans 
	    $scope.showStopButtonForTrack = false; // List of booleans
	    $scope.trackIsPlaying = false; // List of booleans
	}

	$scope.updateTrackButtons = function(trackIndex, entering) {
	    if (entering) {
		if ($scope.trackIsPlaying[trackIndex]) {
		    $scope.showPlayButtonForTrack[trackIndex] = false;
		    $scope.showPlayingButtonForTrack[trackIndex] = false;
		    $scope.showStopButtonForTrack = true;	    
		}
		else {
		    $scope.showPlayButtonForTrack[trackIndex] = true;
		    $scope.showPlayingButtonForTrack[trackIndex] = false;
		    $scope.showStopButtonForTrack = false;
		}
	    }
	    else {
		// Leaving
		if ($scope.trackIsPlaying[trackIndex]) {
		    $scope.showPlayButtonForTrack[trackIndex] = false;
		    $scope.showPlayingButtonForTrack[trackIndex] = true;
		    $scope.showStopButtonForTrack = false;
		}
		else {
		    $scope.showPlayButtonForTrack[trackIndex] = false;
		    $scope.showPlayingButtonForTrack[trackIndex] = false;
		    $scope.showStopButtonForTrack = false;
		}
	    }
	}
	    
	$scope.playPreview = function(trackIndex) {
	    $log.log("Start playing preview '" + currentArtistTrackIDs[trackIndex] + "'");
	    $scope.trackIsPlaying[trackIndex] = true;
	}

	$scope.stopPreview = function(trackIndex) {
	    $log.log("Stop playing preview '" + currentArtistTrackIDs[trackIndex] + "'");
	    $scope.trackIsPlaying[trackIndex] = false;
	}

    }])

    .service('dataService', function($http) {

	this.getPlaylists = function() {
	    return $http.get("/playlists");
	};

	this.getMe = function() {
	    return $http.get("/me");
	}

	this.getPlaylistTracks = function(playlistID, offset, limit) {
	    return $http.get("/playlist/" + playlistID + "?offset=" + offset + "&limit=" + limit + "&fields=items,next");
	}

	this.getMultipleArtists = function (listOfArtistIDs) {
	    return $http.get("/artists?aid=" + listOfArtistIDs.join(',') + "&fields=items,next");
	}

    });
