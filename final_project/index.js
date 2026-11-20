// Modified 2026 by AnnaTverdovska. Original: IBM Skills Network expressBookReviews template (Apache License 2.0).
const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const customer_routes = require('./router/auth_users.js').authenticated;
const genl_routes = require('./router/general.js').general;
const { JWT_SECRET, SESSION_SECRET } = require('./config.js');

const app = express();

app.set('json spaces', 2);
app.use(express.json());

app.use(
    '/customer',
    session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false })
);

// Every route under /customer/auth needs the token stored in the session at login.
app.use('/customer/auth', function auth(req, res, next) {
    const token = req.session.authorization?.accessToken;
    if (!token) {
        return res.status(401).json({ message: 'Log in first: POST /customer/login.' });
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: 'Your login has expired. Log in again.' });
    }
});

app.use('/customer', customer_routes);
app.use('/', genl_routes);

app.use((req, res) => {
    res.status(404).json({ message: `No route for ${req.method} ${req.path}.` });
});

// Malformed JSON bodies and other unexpected errors
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'The request body is not valid JSON.' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
    app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

module.exports = app;
