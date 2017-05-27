'use strict';

const express = require('express');
const morgan = require('morgan');
const SpotifyWebApi = require('spotify-web-api-node');
const generateRandomString = require('./helpers/utils.js').generateRandomString;
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.APP_REDIRECT_PATH;

// Examples from https://github.com/thelinmichael/spotify-web-api-node

// credentials are optional
var spotifyApi = new SpotifyWebApi({
});

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

		var access_token = body.access_token,
		    refresh_token = body.refresh_token;

		var options = {
		    url: 'https://api.spotify.com/v1/me',
		    headers: { 'Authorization': 'Bearer ' + access_token },
		    json: true
		};

		// use the access token to access the Spotify Web API
		request.get(options, function(error, response, body) {
		    console.log(body);
		});

		// we can also pass the token to the browser to make requests from there
		res.redirect('/#' +
			     querystring.stringify({
				 access_token: access_token,
				 refresh_token: refresh_token
			     }));
	    } else {
		res.redirect('/#' +
			     querystring.stringify({
				 error: 'invalid_token'
			     }));
	    }
	});
    }
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

app.use('/bower_components',  express.static(__dirname + '/bower_components'));

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
