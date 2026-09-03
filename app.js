/**
 * Hosting entry point.
 *
 * Hostinger's Node.js application setup (and Phusion Passenger generally)
 * expects a single startup file at the repository root. Everything the app
 * needs lives in server/index.js — this file exists so the platform has a
 * stable, conventional name to point at.
 *
 * Passenger patches http.Server#listen, so the listen() call inside
 * server/index.js is intercepted and bound to the socket Passenger provides;
 * run directly (`node app.js`) it binds PORT/HOST as normal.
 */
module.exports = require('./server/index.js');
