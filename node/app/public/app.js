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
	    return $scope.getPlaylistTracksByID(i, $scope.playlists[i].id,0,80);
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
			    $scope.playlistArtistsByIDs[artistID] = response.data.artists[a];
			}
		    }
		    if (i == 0) {
			$scope.firstPlaylistHasBeenFullyDownloaded= true;
		    }

		});
	};

	$scope.graph = [
	    // nodes
	    { data: { id: 'a' } },
	    { data: { id: 'b' } },
	    { data: { id: 'c' } },
	    // edges
	    {
		data: {
		    id: 'ab',
		    source: 'a',
		    target: 'b'
		}
	    }
	];

	$scope.updateAfterPlaylistStatusChange = function(playlistIndex) {
	    $log.log("playlist with index=" + playlistIndex + " and ID=" + $scope.playlists[playlistIndex].id + " changed status: checkboxModel = ",  $scope.checkboxModel);
	    if ($scope.checkboxModel[playlistIndex]) {
		// Activate
		$scope.addPlaylistArtistsToGraph(playlistIndex);
	    }
	    else {
		// Remove
		$log.log("Hiding elements from playlist with index = " + playlistIndex);
		$scope.cy.filter(function(ele,i,eles){
		    return ele.data('playlist_index') == playlistIndex;
		}).remove();
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

	$scope.circularLayout = {name: 'circle'};

	$scope.initializeGraph = function(playlistIndex) {
	    $scope.cy = cytoscape({
		container:document.getElementById('cy'),
		elements: [],
		layout: $scope.circularLayout,
		style: $scope.graphStyle
	    });
	}

	$scope.addPlaylistArtistsToGraph = function(playlistIndex) {
	    $log.log("Start running $scope.addPlaylistArtistsToGraph")
	    var l = Array.from($scope.playlistArtistIDs[playlistIndex]);
	    $log.log("l = ", l)
	    for (var j = 0; j<l.length; j++) {
		var artistID = l[j];
		$log.log("Adding artist with ID = " + artistID + " to graph", $scope.playlistArtistsByIDs);
		if ($scope.playlistArtistsByIDs[artistID]
		    && $scope.playlistArtistsByIDs[artistID].id
		    &&$scope.playlistArtistsByIDs[artistID].name) {
		    var data = {id: $scope.playlistArtistsByIDs[artistID].id,
				playlist_index: playlistIndex,
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
		    $scope.cy.add({data: data})
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
			  }
		      });

	$scope.refreshGraph = function() {
	    $scope.cy.layout({name:'random'}).run();
	    $scope.cy.resize();
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

	this.getPlaylistTracks = function(playlistID, offset, limit) {
	    return $http.get("/playlist/" + playlistID + "?offset=" + offset + "&limit=" + limit + "&fields=items,next");
	}

	this.getMultipleArtists = function (listOfArtistIDs) {
	    return $http.get("/artists?aid=" + listOfArtistIDs.join(',') + "&fields=items,next");
	}

    });
