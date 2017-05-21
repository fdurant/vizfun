'use strict';

const express = require('express');
const morgan = require('morgan');
const SpotifyWebApi = require('spotify-web-api-node');

// Examples from https://github.com/thelinmichael/spotify-web-api-node

// credentials are optional
var spotifyApi = new SpotifyWebApi({
    clientId : process.env.SPOTIFY_CLIENT_ID,
    clientSecret : process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri : 'http://music.viz.fun/' + process.env.APP_REDIRECT_PATH
});

// Constants
const PORT = 8000;

// App
const app = express();

app.use(morgan('dev'));

app.get('/', function (req, res) {
    res.send('Hello world\n');
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);

// Get Elvis' albums
spotifyApi.getArtistAlbums('43ZHCT0cAZBISjO8DG9PnE')
    .then(function(data) {
	console.log('Artist albums', data.body);
    }, function(err) {
	console.error(err);
    });

// Get the authenticated user
spotifyApi.getMe()
    .then(function(data) {
	console.log('Some information about the authenticated user', data.body);
    }, function(err) {
	console.log('Something went wrong!', err);
    });

