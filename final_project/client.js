// A small client for the bookshop API, showing both async/await and Promise chains.
// Run it against a running server, for example:
//   node client.js all
//   node client.js isbn 1
//   node client.js author "Jane Austen"
//   node client.js title "Things Fall Apart"
// Set BOOKSHOP_URL to use another address than http://localhost:5000.

const baseUrl = () => process.env.BOOKSHOP_URL || 'http://localhost:5000';

// The same request written twice: once with async/await ...
const getJson = async (path) => {
    const response = await fetch(baseUrl() + path);
    const body = await response.json();
    if (!response.ok) {
        throw new Error(body.message || `Request failed with status ${response.status}`);
    }
    return body;
};

// ... and once as a Promise chain.
const getJsonWithPromises = (path) => {
    return fetch(baseUrl() + path)
        .then((response) => response.json().then((body) => ({ response, body })))
        .then(({ response, body }) => {
            if (!response.ok) {
                throw new Error(body.message || `Request failed with status ${response.status}`);
            }
            return body;
        });
};

// All books, with async/await
const getAllBooks = async () => {
    return getJson('/');
};

// One book by ISBN, with a Promise chain
const getBookByIsbn = (isbn) => {
    return getJsonWithPromises(`/isbn/${encodeURIComponent(isbn)}`);
};

// Books by an author, with async/await
const getBooksByAuthor = async (author) => {
    return getJson(`/author/${encodeURIComponent(author)}`);
};

// Books by title, with a Promise chain
const getBooksByTitle = (title) => {
    return getJsonWithPromises(`/title/${encodeURIComponent(title)}`);
};

module.exports = { getAllBooks, getBookByIsbn, getBooksByAuthor, getBooksByTitle };

if (require.main === module) {
    const [command, value] = process.argv.slice(2);
    const commands = {
        all: () => getAllBooks(),
        isbn: () => getBookByIsbn(value),
        author: () => getBooksByAuthor(value),
        title: () => getBooksByTitle(value),
    };
    if (!commands[command] || (command !== 'all' && !value)) {
        console.error('Usage: node client.js all | isbn <isbn> | author <name> | title <title>');
        process.exit(1);
    }
    commands[command]()
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((error) => {
            console.error(error.message);
            process.exit(1);
        });
}
