'use strict';

const express = require('express');
const morgan = require('morgan');
const generateRandomString = require('./helpers/utils.js').generateRandomString;
var request = require('request');
var querystring = require('querystring');
const util = require('util');
var cookieParser = require('cookie-parser');
const SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi({});

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.APP_REDIRECT_PATH;

// Constants
const PORT = 8000;

// App
var stateKey = 'spotify_auth_state';
const app = express();

app.use(morgan('dev'));

app.use(express.static(__dirname + '/public'))
    .use(cookieParser());

app.get('/', function (req, res) {
    res.send('Hello world\n');
});

// Copied from https://github.com/spotify/web-api-auth-examples/blob/master/authorization_code/app.js
app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email';
    res.redirect('https://accounts.spotify.com/authorize?' +
		 querystring.stringify({
		     response_type: 'code',
		     client_id: client_id,
		     scope: scope,
		     redirect_uri: redirect_uri,
		     state: state
		 }));
});

app.get('/callback', function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
	res.redirect('/#' +
		     querystring.stringify({
			 error: 'state_mismatch'
		     }));
    } else {
	res.clearCookie(stateKey);
	var authOptions = {
	    url: 'https://accounts.spotify.com/api/token',
	    form: {
		code: code,
		redirect_uri: redirect_uri,
		grant_type: 'authorization_code'
	    },
	    headers: {
		'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
	    },
	    json: true
	};

	request.post(authOptions, function(error, response, body) {
	    if (!error && response.statusCode === 200) {

		var access_token = body.access_token;
		var refresh_token = body.refresh_token;

		// STORE AS COOKIE FOR LATER USE
		res.cookie('spotifyAccessTokenForMusicVizFun', access_token, { maxAge: 86400, httpOnly: true });
		res.cookie('spotifyRefreshTokenForMusicVizFun', refresh_token, { maxAge: 86400, httpOnly: true });
		spotifyApi.setAccessToken(access_token);
		spotifyApi.setRefreshToken(refresh_token);

		// we can also pass the token to the browser to make requests from there
/*		res.redirect('/#' +
			     querystring.stringify({
				 access_token: access_token,
				 refresh_token: refresh_token
			     }));
*/

//		res.redirect('/me'); 
		res.redirect('/#'); 

	    } else {
		res.redirect('/#' +
			     querystring.stringify({
				 error: 'invalid_token'
			     }));
	    }
	});
    }

});

app.get('/me', function(req, res) {

    var me = spotifyApi.getMe()
	.then(function(data) {
	    console.log('Some information about the authenticated user', data.body);
	    console.log('data.body.id = ', data.body.id);
	    res.cookie('spotifyCurrentUserId', data.body.id, { maxAge: 86400, httpOnly: true });
	    //	    res.redirect('/playlists'); 
//	    res.redirect('/#'); 
	    res.send(data);
	}, function(err) {
	    console.log('Something went wrong!', err);
	    res.send({'err': err});
//	    res.redirect('/#');
	});
	
});


app.get('/refresh_token', function(req, res) {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
	url: 'https://accounts.spotify.com/api/token',
	headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
	form: {
	    grant_type: 'refresh_token',
	    refresh_token: refresh_token
	},
	json: true
    };

    request.post(authOptions, function(error, response, body) {
	if (!error && response.statusCode === 200) {
	    var access_token = body.access_token;
	    res.send({
		'access_token': access_token
	    });
	}
    });
});

app.get('/playlists', function(req, res) {

    var currentUserId = req.cookies.spotifyCurrentUserId;
    
    var playlists = spotifyApi.getUserPlaylists(currentUserId)
	.then(function(data) {
	    console.log('Retrieved user playlists: ');
	    console.log(util.inspect(data.body, false, null))
	},function(err) {
	    console.log('Something went wrong!', err);
	});
    
    res.redirect('/#');

});

app.get('/playlist/:playlistid?', function(req, res) {

    var currentUserId = req.cookies.spotifyCurrentUserId;
    var playlistId = req.params.playlistid;
    
    var playlist = spotifyApi.getPlaylistTracks(currentUserId, playlistId, req.query)
	.then(function(data) {
	    console.log('Retrieved user playlist ' + playlistId + ': ');
	    console.log(util.inspect(data.body, false, null))
	},function(err) {
	    console.log('Something went wrong!', err);
	});
    
    res.redirect('/#');

});

app.get('/artist/:artistid', function(req, res) {

    var artistId = req.params.artistid;
    
    var artist = spotifyApi.getArtist(artistId)
	.then(function(data) {
	    console.log('Retrieved artist ' + artistId + ': ');
	    console.log(util.inspect(data.body, false, null))
	},function(err) {
	    console.log('Something went wrong!', err);
	});
    
    res.redirect('/#');

});

// Get multiple artists in one go. The response contains a.o. genre info about these artists
// http://music.viz.fun/artists?aid=3mQBpAOMWYqAZyxtyeo4Lo&aid=3oZa8Xs6IjlIUGLAhVyK4G
app.get('/artists?', function(req, res) {

    // First assemble the artist IDs in one array
    var artistIds = [];

    if (typeof req.query.aid === 'string') {
	artistIds.push(req.query.aid);
    }
    else {
	artistIds = Array.from(req.query.aid);
    }
    
    
    var artists = spotifyApi.getArtists(artistIds)
	.then(function(data) {
	    console.log('Retrieved artists [' + artistIds.join(',') + ']: ');
	    console.log(util.inspect(data.body, false, null))
	},function(err) {
	    console.log('Something went wrong!', err);
	});
    
    res.redirect('/#');

});

app.use('/bower_components',  express.static(__dirname + '/bower_components'));

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
