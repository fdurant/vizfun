'use strict';

var express = require('express');
const morgan = require('morgan');
const generateRandomString = require('./helpers/utils.js').generateRandomString;
var request = require('request');
var querystring = require('querystring');
const util = require('util');

// Session management with redis
// Inspired by https://pragprog.com/book/kdnodesec/secure-your-node-js-web-application
// Chapter 8: Focus on Session Management
// See also https://github.com/rajaraodv/rabbitpubsub/issues/4
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
const redis_host = process.env.REDIS_HOST;
const redis_port = process.env.REDIS_PORT;
const redis_pwd = process.env.REDIS_PASSWORD;
const redis_secret = process.env.REDIS_SECRET;

// Spotify
const SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi({});
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.APP_REDIRECT_PATH;

session.Session.prototype.login = function login(cb) {
    var req = this.req;
    this.regenerate(function (err) {
	if(err) {
	    cb(err);
	    return;
	}
	req.session._loggedInAt = Date.now();
	req.session._ip = req.ip;
	req.session._ua = req.headers['user-agent'];
    });
}

session.Session.prototype.isLoggedIn = function isLoggedIn() {
    return !!this._loggedInAt;
}

session.Session.prototype.isFresh = function isFresh() {
    // Return true if logged in less than 20 minutes ago
    return (this._loggedInAt && (Date.now() - this._loggedInAt) < (1000 * 60 * 20))
}

// Constants
const PORT = 8000;

// App
var stateKey = 'spotify_auth_state';
var cookieParser = require('cookie-parser'); // TO DO: Move cookies to REDIS store on server instead
const app = express();

app.use(morgan('dev'));

app.use(express.static(__dirname + '/public'))
    .use(cookieParser());

app.use(session({
    store: new RedisStore({
	host:redis_host,
	port:redis_port,
	db: 2,
	pass: redis_pwd,
	ttl: (1 * 60), // Time-to-Live in seconds
	logErrors: true
    }),
    name: 'id',
    secret:redis_secret,
    resave:false,
    saveUninitialized:false,
    cookie: {
	secure: true, // Set the cookie only to be served with HTTPS
	path: '/',
	httpOnly: true, // Mitigate XXS (cross-site scripts)
	maxAge: null
    }
}));

app.get('/', function (req, res) {
    if (!req.session.views) {
	req.session.views = 0;
    }
    req.session.views++;
    res.send('Hello world (' + req.session.views + ' times so far)\n');
});

// Copied from https://github.com/spotify/web-api-auth-examples/blob/master/authorization_code/app.js
app.get('/login', function(req, res) {

    req.session.login();
    
    var state = generateRandomString(16);
    res.cookie(stateKey, state);
    console.log('state = ', state);
    req.session._spotify_auth_state = state;
    console.log('req.session._spotify_auth_state = ', req.session._spotify_auth_state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email playlist-read-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
		 querystring.stringify({
		     response_type: 'code',
		     client_id: client_id,
		     scope: scope,
		     redirect_uri: redirect_uri,
		     state: state,
		     show_dialog: true
		 }));
});

app.get('/logout', function(req, res) {

    req.session.destroy(); // Delete session
    
});


app.get('/callback', function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    console.log('code = ', code);
    console.log('state = ', state);
    console.log('req.session = ', req.session);
    console.log('req.session._spotify_auth_state = ', req.session._spotify_auth_state);
//    var storedState = req.session._spotify_auth_state ? req.session._spotify_auth_state : null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
    console.log('storedState = ', storedState);

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

		// STORE AS SESSION VARIABLE FOR LATER USE
		req.session._spotifyAccessTokenForMusicVizFun = access_token;
		req.session._spotifyRefreshTokenForMusicVizFun = refresh_token;
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
	    req.session._spotifyCurrentUserId = data.body.id;
	    //	    res.redirect('/playlists'); 
//	    res.redirect('/#'); 
	    res.send(data);
	}, function(err) {
	    console.log('User not (yet/anymore) authenticated with Spotify!', err);
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

    var currentUserId = req.session._spotifyCurrentUserId;
    
    var playlists = spotifyApi.getUserPlaylists(currentUserId)
	.then(function(data) {
	    console.log('Retrieved user playlists: ');
	    console.log(util.inspect(data.body, false, null))
	    res.send(data.body);
	},function(err) {
	    console.log('Could not get user playlists!', err);
	    res.send(null);
	});
    
//    res.redirect('/#');

});

app.get('/playlist/:playlistid?', function(req, res) {

    var playlistOwner = req.query.playlistowner;
    var playlistId = req.params.playlistid;
    
    var playlist = spotifyApi.getPlaylistTracks(playlistOwner, playlistId, req.query)
	.then(function(data) {
	    console.log('Retrieved playlist ' + playlistId + ' from user ' + playlistOwner + ': ');
//	    console.log(util.inspect(data.body, false, null))
	    res.send(data.body);
	},function(err) {
	    console.log('Something went wrong!', err);
	    res.send(null);
	});
    
//    res.redirect('/#');

});

app.get('/artist/:artistid', function(req, res) {

    var artistId = req.params.artistid;
    
    var artist = spotifyApi.getArtist(artistId)
	.then(function(data) {
	    console.log('Retrieved artist ' + artistId + ': ');
	    console.log(util.inspect(data.body, false, null))
	    res.send(data.body);
	},function(err) {
	    console.log('Something went wrong!', err);
	    res.send(null);
	});
    
//    res.redirect('/#');

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
//	    console.log(util.inspect(data.body, false, null))
	    res.send(data.body);
	},function(err) {
	    console.log('Something went wrong!', err);
	    res.send(null);
	});
    
//    res.redirect('/#');

});

app.use('/bower_components',  express.static(__dirname + '/bower_components'));

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
