'use strict';

angular.module('musicVizFunApp', ["angucomplete-alt"])

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
	$scope.firstPlaylistTurnedIntoGraph = false;
	
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
	$scope.showMusicButtonForTrack = []; // List of booleans
	$scope.showNotAvailableButtonForTrack = []; // List of booleans

	// audio
	$scope.audioPlayer = null;
	$scope.currentTrackPlaying = null; // assigned by Howler
	$scope.currentTrackIndex = null; // Index in list of tracks for current artist
	
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
				      // Exclude playlists without image url
				      $log.log('response.data.items = ', response.data.items);
				      for (var i=0; i<response.data.items.length; i++) {
					  if (response.data.items[i].images && response.data.items[i].images[0] && response.data.items[i].images[0].url) {
					      $scope.playlists.push(response.data.items[i]);
					  }
				      }
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
	    return $scope.getPlaylistTracksByID(i, $scope.playlists[i].id, $scope.playlists[i].owner.id, 0 ,nrTracksPerDownload);
	}

	$scope.getPlaylistTracksByID = function(i,id,owner,offset,increment) {
	    var getPlaylistTracks = dataService.getPlaylistTracks(id,owner,offset,increment)
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
			$scope.getPlaylistTracksByID(i,id,owner,offset+increment,increment);
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

		$scope.stopPreview($scope.currentTrackIndex);

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
	    },
	    {
		selector: 'edge',
		style: {
		    'width': 0.5,
		    'line-color': 'red',
		    'mid-target-arrow-shape': 'circle',
		    'mid-target-arrow-color': 'red'
		}
	    }
	];
	
	$scope.cy = null;
	$scope.artistNodes = [];
	
	$scope.initializeGraph = function(playlistIndex) {
	    $scope.cy = cytoscape({
		container:document.getElementById('cy'),
		elements: [],
		layout: {name: 'random'},
		style: $scope.graphStyle
	    });
	    $scope.cy.panzoom({});
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
		    if ($scope.playlistArtistsByIDs[artistID].genres) {
			$log.log('genres for ' + $scope.playlistArtistsByIDs[artistID].name + ' = ', $scope.playlistArtistsByIDs[artistID].genres);
			var genres = $scope.playlistArtistsByIDs[artistID].genres || [];
			data['genres'] = new Set(genres);
		    }
		    else {
			
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
				// Stop anything that's still playing from the previous artist
				// If this list is empty, that's because there is no previous artist (yet)
				$log.log("(0) $scope.currentTrackIndex = ", $scope.currentTrackIndex)
				$scope.stopPreview($scope.currentTrackIndex, false);

				$log.log("(1) $scope.currentTrackIndex", $scope.currentTrackIndex)
				
				// And set up the new artist
				$scope.currentArtistID = thisArtistID;
				$scope.currentArtistTrackIDs = thisArtistTrackIDs;

				$log.log("(2) $scope.currentTrackIndex", $scope.currentTrackIndex)
				for (var t = 0; t<$scope.currentArtistTrackIDs.length; t++) {
				    $scope.initializeTrackButtons(t,$scope.currentArtistTrackIDs[t]);
				}

				if ($scope.currentArtistTrackIDs.length > 0) {
				    // Start playing the first one right away
				    $scope.playOrStop(0,$scope.currentArtistTrackIDs[0]);
				}
				$log.log("(3) $scope.currentArtistTrackIDs", $scope.currentArtistTrackIDs)
			    });
			    $log.log('Tapped ', this.data().name, this.data().id, this.data().trackIDs);
			});
			$scope.artistNodes.push(data);
		    }
		}
		
	    }

	    $scope.cy.viewport({zoom: 1,
				pan: {x:100, y:100}});
	    $scope.cy.layout({name: 'random'}).run();
	    $scope.cy.resize();
	    $log.log("$scope.artistNodes = ", $scope.artistNodes);
	    $scope.firstPlaylistTurnedIntoGraph = true;
	    $log.log("Done running $scope.addPlaylistArtistsToGraph for playlist with index = " + playlistIndex);
	}

	$scope.$watch(function() {return $scope.firstPlaylistHasBeenFullyDownloaded},
		      function(newValue, oldValue) {
			  $log.log('$scope.firstPlaylistHasBeenFullyDownloaded value was: ' + oldValue +' and now is: ' + newValue);
			  if (newValue) {
			      $scope.addPlaylistArtistsToGraph(0);
			  }
		      });

	$scope.$watch(function() {return $scope.firstPlaylistTurnedIntoGraph},
		      function(newValue, oldValue) {
			  $log.log('$scope.firstPlaylistTurnedIntoGraph value was: ' + oldValue +' and now is: ' + newValue);
			  if (newValue) {
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
			    $log.log("Could not find artistID " + artistID + " for track '" +track.name + "'" )
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

	$scope.linkArtists = function(simThreshold, strongestN) {
	    simThreshold = simThreshold || 0.50;
	    strongestN = strongestN || 2;
	    var allArtists = $scope.cy.nodes();
	    var nrArtists = allArtists.length;
	    // Symmetric similarity matrix
	    // Diagonals set to zero, because we're not interested in self-similarity
	    var similarityMatrix = math.zeros(allArtists.length, allArtists.length);
	    var commonGenresMatrix = new Array(allArtists.length).fill(new Array(allArtists.length).fill([]));
	    $scope.cy.batch(function() {
		for (var i=0; i<nrArtists; i++) {
		    for (var j=i+1; j<nrArtists; j++) {
			var a1 = allArtists[i];
			var a2 = allArtists[j];
			var res = $scope.calculateSimilarity(a1, a2);
			// Matrix is symmetric. No need to store value if smaller than threshold
			if (res.simScore >= simThreshold) {
			    similarityMatrix.subset(math.index(i,j), res.simScore);
			    similarityMatrix.subset(math.index(j,i), res.simScore);
			    commonGenresMatrix[i][j] = Array.from(res.intersection);
			    commonGenresMatrix[j][i] = Array.from(res.intersection);
			}
		    }
		}
//		$log.log("similarityMatrix = ", similarityMatrix)
		// Loop over the rows, and make a new edge
		// for the top-N links
		// if and only if the link is stronger than the threshold
		for (var i=0; i<nrArtists; i++) {
		    var row = similarityMatrix.subset(math.index(i,math.range(0,nrArtists))).valueOf()[0];
//		    $log.log("row = ", row);
		    var indices = new Array(nrArtists);
		    for (var k = 0; k < nrArtists; ++k) indices[k] = k;
//		    $log.log("unsorted indices = ", indices);
		    indices.sort(function (a, b) { return row[a] > row[b] ? -1 : row[a] < row[b] ? 1 : 0; });
//		    $log.log("sorted indices = ", indices);
		    // Create the edges
		    for (var s=0; s<strongestN; s++) {
			var j = indices[s];
			var simScore = row[j];
			if (simScore >= simThreshold) {
			    var a1 = allArtists[i];
			    var a2 = allArtists[j];
			    // We want to prevent bidirectional (i.e. double) edges
			    var sourceNode, targetNode, sourceId, targetId = null;
			    if (a1.data().id <= a2.data().id) {
				sourceNode = a1;
				targetNode = a2
			    }
			    else {
				sourceNode = a2;
				targetNode = a1;
			    }
			    sourceId = sourceNode.data().id;
			    targetId = targetNode.data().id;
			    var edgeId = sourceId + '_' + targetId;
			    if ($scope.cy.$("[id = '" + edgeId + "']").length > 0) {
//				$log.log("No need to create edge " + edgeId + " twice!");
				continue;
			    }
			    var edge = { id : edgeId,
					 source : sourceId,
					 target: targetId,
					 simScore: simScore,
					 common_genres: commonGenresMatrix[i][j]};
//			    $log.log('commonGenresMatrix[i][j] = ', commonGenresMatrix[i][j])
			    var qtip = {content: '<p>Genres shared by ' + sourceNode.data().name
					+  ' and ' + targetNode.data().name + ':</p>'
					+ '<ul>\n<li>' + commonGenresMatrix[i][j].join('</li>\n<li>') + '</li>\n</ul>',
					position: {
					    my: 'top center',
					    at: 'bottom center'
					},
					show: {
					    event: 'mouseover',
					    solo: true
					},
					hide: {
					    event: 'mouseout'
					},
					style: {
					    classes: 'qtip-bootstrap',
					    tip: {
						width: 16,
						height:8
					    }
					}}
			    // https://stackoverflow.com/questions/20993149/how-to-add-tooltip-on-mouseover-event-on-nodes-in-graph-with-cytoscape-js
			    $scope.cy.add({data: edge}).qtip(qtip);
			}
			
		    }
		}		

	    })
	    $log.log("linked graph");
	}

	$scope.calculateSimilarity = function(artistNode1, artistNode2) {
	    var setOfGenres1 = artistNode1.data().genres;
	    var setOfGenres2 = artistNode2.data().genres;
	    var intersection = new Set();
	    for (let elem of setOfGenres1) {
		if (setOfGenres2.has(elem)) {
		    intersection.add(elem);
		}
	    }
	    if (intersection.size == 0) {
		return {'simScore':0,
			'intersection':[]};
	    }
	    var union = new Set(setOfGenres1);
	    for (let elem of setOfGenres2) {
		union.add(elem);
	    }
	    if (setOfGenres1.size > 0 && setOfGenres1.size > 0) {
		// Jaccard similarity
		var simScore = intersection.size / union.size;
		
//		$log.log("Similarity between '" + artistNode1.data().name + "' and '" + artistNode2.data().name + "' = " + simScore);
//		$log.log('Intersection: ', Array.from(intersection));
//		$log.log('Union: ', Array.from(union));
		return {'simScore':simScore,
			'intersection': intersection};
	    }
	    else {
		return 0;
	    }
	}

	$scope.layoutArtists = function() {
	    var colaLayout = {name : 'cola',
			      refresh:5,
			      maxSimulationTime: 5000,
			      padding:70,
			      nodeSpacing: function( node ){ return 10; }
			     };
	    $scope.cy.layout(colaLayout).run();
	    $scope.cy.resize();
	    $log.log("layed out graph");
	}

	$scope.initializeAudio = function(trackIndex) {
	    var trackID = $scope.currentArtistTrackIDs[trackIndex];
	    var trackUrl = $scope.playlistTracksByIDs[trackID].track.preview_url;
	    $scope.audioPlayer = new Howl({
		src: [trackUrl],
		html5: true,
		volume: 0.5,
	    }).on('end', function(audioId) {
		$log.log("Running audioEndHandler()");
		$scope.stopPreview(trackIndex, false);
	    });
	    $log.log("Initialized audio for '" + $scope.playlistTracksByIDs[trackID].track.name + "' (trackID " + trackID + "'");
	    $log.log("URL for '" + $scope.playlistTracksByIDs[trackID].track.name + "' is " + trackUrl);
	}

	$scope.initializeTrackButtons = function(trackIndex,trackID) {
	    $log.log("Running initializeTrackButtons(" + trackIndex + ")")
	    $scope.showPlayButtonForTrack[trackIndex] = false; // List of booleans 
	    $scope.showStopButtonForTrack[trackIndex] = false; // List of booleans
	    if (! $scope.playlistTracksByIDs[trackID].track.preview_url) {
		$log.log("No audio preview available for trackID = " + trackID);
		$scope.showNotAvailableButtonForTrack[trackIndex] = true;
		$scope.showPlayingButtonForTrack[trackIndex] = false;
	    }
	    else {
		$scope.showPlayingButtonForTrack[trackIndex] = trackIndex == 0 ? true : false; // List of booleans 
		$scope.showNotAvailableButtonForTrack[trackIndex] = false;
	    }
	    $scope.updateMusicButtonForTrack(trackIndex)
	}

	$scope.updateTrackButtons = function(trackIndex, entering, trackID) {
	    if (! $scope.playlistTracksByIDs[trackID].track.preview_url) {
		$log.log("No audio preview available for trackID = " + trackID);
		$scope.showNotAvailableButtonForTrack[trackIndex] = true;
		$scope.showPlayingButtonForTrack[trackIndex] = false;
	    }
	    else {
		$scope.showNotAvailableButtonForTrack[trackIndex] = false;
		$log.log("trackID = " + trackID);
		if (entering) {
		    if ($scope.currentTrackIndex == trackIndex) {
			$scope.showPlayButtonForTrack[trackIndex] = false;
			$scope.showPlayingButtonForTrack[trackIndex] = false;
			$scope.showStopButtonForTrack[trackIndex] = true;	    
		    }
		    else {
			$scope.showPlayButtonForTrack[trackIndex] = true;
			$scope.showPlayingButtonForTrack[trackIndex] = false;
			$scope.showStopButtonForTrack[trackIndex] = false;
		    }
		}
		else {
		    // Leaving
		    if ($scope.currentTrackIndex == trackIndex) {
			$scope.showPlayButtonForTrack[trackIndex] = false;
			$scope.showPlayingButtonForTrack[trackIndex] = true;
			$scope.showStopButtonForTrack[trackIndex] = false;
		    }
		    else {
			$scope.showPlayButtonForTrack[trackIndex] = false;
			$scope.showPlayingButtonForTrack[trackIndex] = false;
			$scope.showStopButtonForTrack[trackIndex] = false;
		    }
		}
	    }
	    $scope.updateMusicButtonForTrack(trackIndex)
	}

	$scope.updateMusicButtonForTrack = function(trackIndex) {
	    $log.log("Running updateMusicButtonForTrack(" + trackIndex + ")")
	    $scope.showMusicButtonForTrack[trackIndex] = !($scope.showPlayButtonForTrack[trackIndex] ||
							   $scope.showPlayingButtonForTrack[trackIndex] ||
							   $scope.showNotAvailableButtonForTrack[trackIndex] ||
							   $scope.showStopButtonForTrack[trackIndex]);
	}
	    
	$scope.playOrStop = function(trackIndex,trackID) {
	    if (($scope.currentTrackIndex == trackIndex)
		&& ($scope.showStopButtonForTrack[trackIndex] ||
		    $scope.showPlayingButtonForTrack[trackIndex])) {
		$log.log("playOrStop (if): About to run $scope.stopPreview()")
		$scope.stopPreview(trackIndex,false);
	    }
	    else if (($scope.currentTrackIndex != trackIndex) && $scope.showPlayButtonForTrack[trackIndex]) {
		$log.log("playOrStop (else if): About to run $scope.playPreview(" + trackIndex + ")")
		$scope.playPreview(trackIndex,trackID);
	    }
	    else {
		// Initialization of tracks for a newly tapped artist
		$log.log("playOrStop (else): About to run $scope.playPreview(" + trackIndex + ")")
		$scope.playPreview(0,trackID);
	    }
	}

	$scope.playPreview = function(trackIndex, trackID) {
	    if (! $scope.playlistTracksByIDs[trackID].track.preview_url) {
		$log.log("No audio preview available for trackID = " + trackID);
		$scope.showNotAvailableButtonForTrack[trackIndex] = true;
	    }
	    else {
		// There can be only one preview playing at any time
		$scope.stopPreview($scope.currentTrackIndex, false);

		$log.log("Start playing preview");
		$scope.initializeAudio(trackIndex);
		$scope.currentTrackPlaying = $scope.audioPlayer.play();
		$scope.currentTrackIndex = trackIndex;
		$log.log("$scope.currentTrackPlaying = ", $scope.currentTrackPlaying)
		$log.log("$scope.currentTrackIndex = ", $scope.currentTrackIndex)
		
		$scope.showPlayButtonForTrack[trackIndex] = false;
		$scope.showPlayingButtonForTrack[trackIndex] = true;
		$scope.showStopButtonForTrack[trackIndex] = false;
	    }
	    $scope.updateMusicButtonForTrack(trackIndex)
	}

	$scope.stopPreview = function(trackIndex, inFocus) {
	    $log.log("Stop playing preview (trackIndex = " + trackIndex + "; inFocus = " + inFocus + ")");

	    $log.log("$scope.currentTrackIndex = ", $scope.currentTrackIndex)
	    if ($scope.currentTrackPlaying) {
		$log.log("STOP")
		$scope.audioPlayer.stop();
		$scope.currentTrackIndex = null;

		if (!inFocus) {
		    $scope.showPlayButtonForTrack[trackIndex] = false;
		}
		$scope.showPlayingButtonForTrack[trackIndex] = false;
		$scope.showStopButtonForTrack[trackIndex] = false;
	    }

	    // Using timeout to force a reevaluation pf ng-show condition, even when nothing was clicked
	    $timeout($scope.updateMusicButtonForTrack(trackIndex));
	    
	    $log.log("$scope.showPlayButtonForTrack["+trackIndex+"] = ", $scope.showPlayButtonForTrack[trackIndex])
	    $log.log("$scope.showPlayingButtonForTrack["+trackIndex+"] = ", $scope.showPlayingButtonForTrack[trackIndex])
	    $log.log("$scope.showStopButtonForTrack["+trackIndex+"] = ", $scope.showStopButtonForTrack[trackIndex])
	    $log.log("$scope.showMusicButtonForTrack["+trackIndex+"] = ", $scope.showMusicButtonForTrack[trackIndex])
	}
	
    }]);
