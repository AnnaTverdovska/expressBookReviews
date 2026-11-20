// Settings shared by the login route and the authentication check.
// Set JWT_SECRET and SESSION_SECRET in the environment for anything beyond local use.
const crypto = require('crypto');

// Without configured secrets, generate random ones per start: sessions then end on restart,
// but no well-known secret can be used to forge tokens.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_LIFETIME = '1h';

module.exports = { JWT_SECRET, SESSION_SECRET, TOKEN_LIFETIME };
