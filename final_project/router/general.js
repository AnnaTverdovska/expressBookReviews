// Modified 2026 by AnnaTverdovska. Original: IBM Skills Network expressBookReviews template (Apache License 2.0).
const express = require('express');
let books = require('./booksdb.js');
const { isValid, userExists, addUser } = require('./auth_users.js');
const public_users = express.Router();

const MIN_PASSWORD_LENGTH = 8;

// Books as a list that keeps each book's ISBN.
const withIsbn = (isbn) => ({ isbn, ...books[isbn] });

// Case-insensitive search on one field; returns an empty list when nothing matches.
const findBooks = (field, value) => {
    const wanted = value.trim().toLowerCase();
    return Object.keys(books)
        .filter((isbn) => books[isbn][field].toLowerCase() === wanted)
        .map(withIsbn);
};

public_users.post('/register', (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        return res.status(400).json({ message: 'Send both a username and a password.' });
    }
    if (!isValid(username)) {
        return res
            .status(400)
            .json({ message: 'Usernames are 3 to 30 letters, digits, dots, dashes or underscores.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (userExists(username)) {
        return res.status(409).json({ message: `The username ${username} is taken. Choose another one.` });
    }
    addUser(username, password);
    return res.status(201).json({ message: `Registered ${username}. You can now log in.` });
});

// Get the book list available in the shop
public_users.get('/', (req, res) => {
    return res.json(books);
});

// Get book details based on ISBN
public_users.get('/isbn/:isbn', (req, res) => {
    const { isbn } = req.params;
    if (!books[isbn]) {
        return res.status(404).json({ message: `No book with ISBN ${isbn}.` });
    }
    return res.json(withIsbn(isbn));
});

// Get book details based on author
public_users.get('/author/:author', (req, res) => {
    return res.json(findBooks('author', req.params.author));
});

// Get all books based on title
public_users.get('/title/:title', (req, res) => {
    return res.json(findBooks('title', req.params.title));
});

// Get book review
public_users.get('/review/:isbn', (req, res) => {
    const { isbn } = req.params;
    if (!books[isbn]) {
        return res.status(404).json({ message: `No book with ISBN ${isbn}.` });
    }
    return res.json(books[isbn].reviews);
});

module.exports.general = public_users;
