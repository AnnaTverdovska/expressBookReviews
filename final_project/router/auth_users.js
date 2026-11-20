// Modified 2026 by AnnaTverdovska. Original: IBM Skills Network expressBookReviews template (Apache License 2.0).
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
let books = require('./booksdb.js');
const { JWT_SECRET, TOKEN_LIFETIME } = require('../config.js');
const regd_users = express.Router();

// Registered users: { username, salt, passwordHash }. Passwords are never stored in plain text.
let users = [];

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');

// True when the username has an allowed format: 3–30 letters, digits, dots, dashes or underscores.
const isValid = (username) => typeof username === 'string' && USERNAME_PATTERN.test(username);

const userExists = (username) => users.some((user) => user.username === username);

const addUser = (username, password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    users.push({ username, salt, passwordHash: hashPassword(password, salt) });
};

// True when the username and password match a registered user.
const authenticatedUser = (username, password) => {
    const user = users.find((u) => u.username === username);
    if (!user || typeof password !== 'string') {
        return false;
    }
    const expected = Buffer.from(user.passwordHash, 'hex');
    const actual = Buffer.from(hashPassword(password, user.salt), 'hex');
    return crypto.timingSafeEqual(expected, actual);
};

// Only registered users can log in. The token is kept in the session, so later
// requests from the same client are recognised by their session cookie.
regd_users.post('/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        return res.status(400).json({ message: 'Send both a username and a password.' });
    }
    if (!authenticatedUser(username, password)) {
        return res.status(401).json({ message: 'Wrong username or password.' });
    }
    const accessToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_LIFETIME });
    req.session.authorization = { accessToken, username };
    return res.json({ message: `Logged in as ${username}.` });
});

regd_users.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

// Add a book review, or replace your earlier review of the same book.
// The review text can be sent as ?review=... or as {"review": "..."}.
regd_users.put('/auth/review/:isbn', (req, res) => {
    const { isbn } = req.params;
    const book = books[isbn];
    if (!book) {
        return res.status(404).json({ message: `No book with ISBN ${isbn}.` });
    }
    const review = String(req.query.review ?? req.body?.review ?? '').trim();
    if (!review) {
        return res.status(400).json({ message: 'The review is empty. Send it as ?review=... or {"review": "..."}.' });
    }
    const { username } = req.user;
    const updated = username in book.reviews;
    book.reviews[username] = review;
    return res.status(updated ? 200 : 201).json({
        message: updated ? `Your review of "${book.title}" was updated.` : `Your review of "${book.title}" was added.`,
        reviews: book.reviews,
    });
});

// Delete your own review of a book. Other users' reviews are never touched.
regd_users.delete('/auth/review/:isbn', (req, res) => {
    const { isbn } = req.params;
    const book = books[isbn];
    if (!book) {
        return res.status(404).json({ message: `No book with ISBN ${isbn}.` });
    }
    const { username } = req.user;
    if (!(username in book.reviews)) {
        return res.status(404).json({ message: `You have not reviewed "${book.title}".` });
    }
    delete book.reviews[username];
    return res.json({ message: `Your review of "${book.title}" was deleted.`, reviews: book.reviews });
});

module.exports.authenticated = regd_users;
module.exports.isValid = isValid;
module.exports.userExists = userExists;
module.exports.addUser = addUser;
module.exports.authenticatedUser = authenticatedUser;
module.exports.users = users;
