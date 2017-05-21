'use strict';

const express = require('express');
const morgan = require('morgan');

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
