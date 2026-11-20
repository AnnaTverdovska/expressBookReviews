// Tests for the bookshop API, run with Node's built-in test runner: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../index.js');
const { users } = require('../router/auth_users.js');
const client = require('../client.js');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    process.env.BOOKSHOP_URL = baseUrl;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Sends a request and returns { status, body, cookie }.
const call = async (method, path, { json, cookie } = {}) => {
    const headers = {};
    if (json !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const response = await fetch(baseUrl + path, {
        method,
        headers,
        body: json === undefined ? undefined : typeof json === 'string' ? json : JSON.stringify(json),
    });
    const setCookie = response.headers.get('set-cookie');
    return {
        status: response.status,
        body: await response.json(),
        cookie: setCookie ? setCookie.split(';')[0] : undefined,
    };
};

const registerAndLogin = async (username, password = 'correct-horse') => {
    await call('POST', '/register', { json: { username, password } });
    const login = await call('POST', '/customer/login', { json: { username, password } });
    assert.equal(login.status, 200);
    return login.cookie;
};

test('lists all books', async () => {
    const { status, body } = await call('GET', '/');
    assert.equal(status, 200);
    assert.equal(Object.keys(body).length, 10);
    assert.equal(body[1].title, 'Things Fall Apart');
});

test('finds a book by ISBN and explains unknown ones', async () => {
    const found = await call('GET', '/isbn/8');
    assert.equal(found.status, 200);
    assert.deepEqual(
        { isbn: found.body.isbn, title: found.body.title },
        { isbn: '8', title: 'Pride and Prejudice' }
    );

    const missing = await call('GET', '/isbn/99');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'No book with ISBN 99.');
});

test('searches by author and title, ignoring case', async () => {
    const austen = await call('GET', '/author/jane%20austen');
    assert.deepEqual(austen.body.map((b) => b.isbn), ['8']);

    const unknownAuthor = await call('GET', '/author/Unknown');
    assert.equal(unknownAuthor.body.length, 4);

    const title = await call('GET', '/title/the%20divine%20comedy');
    assert.equal(title.body[0].author, 'Dante Alighieri');

    const none = await call('GET', '/author/Nobody');
    assert.equal(none.status, 200);
    assert.deepEqual(none.body, []);
});

test('registers users and rejects bad or duplicate sign-ups', async () => {
    assert.equal((await call('POST', '/register', { json: {} })).status, 400);
    assert.equal(
        (await call('POST', '/register', { json: { username: 'a b', password: 'long enough' } })).status,
        400
    );
    assert.equal(
        (await call('POST', '/register', { json: { username: 'shorty', password: 'short' } })).status,
        400
    );

    const created = await call('POST', '/register', { json: { username: 'reader1', password: 'correct-horse' } });
    assert.equal(created.status, 201);

    const duplicate = await call('POST', '/register', { json: { username: 'reader1', password: 'another-one' } });
    assert.equal(duplicate.status, 409);
});

test('stores only a salted hash of the password', () => {
    const user = users.find((u) => u.username === 'reader1');
    assert.ok(user);
    assert.equal(user.password, undefined);
    assert.notEqual(user.passwordHash, 'correct-horse');
    assert.match(user.passwordHash, /^[0-9a-f]{128}$/);
});

test('logs in only with the right password', async () => {
    assert.equal((await call('POST', '/customer/login', { json: { username: 'reader1' } })).status, 400);
    const wrong = await call('POST', '/customer/login', { json: { username: 'reader1', password: 'nope-nope' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.cookie, undefined);

    const right = await call('POST', '/customer/login', { json: { username: 'reader1', password: 'correct-horse' } });
    assert.equal(right.status, 200);
    assert.ok(right.cookie, 'login should start a session');
});

test('review routes need a login', async () => {
    const put = await call('PUT', '/customer/auth/review/1?review=Great');
    assert.equal(put.status, 401);
    assert.equal((await call('DELETE', '/customer/auth/review/1')).status, 401);
});

test('adds, updates and deletes your own review only', async () => {
    const alice = await registerAndLogin('alice');
    const bob = await registerAndLogin('bob');

    const added = await call('PUT', '/customer/auth/review/3?review=Long%20but%20worth%20it', { cookie: alice });
    assert.equal(added.status, 201);

    const updated = await call('PUT', '/customer/auth/review/3', { cookie: alice, json: { review: 'A classic.' } });
    assert.equal(updated.status, 200);

    await call('PUT', '/customer/auth/review/3?review=Too%20long', { cookie: bob });
    const reviews = await call('GET', '/review/3');
    assert.deepEqual(reviews.body, { alice: 'A classic.', bob: 'Too long' });

    const deleted = await call('DELETE', '/customer/auth/review/3', { cookie: alice });
    assert.equal(deleted.status, 200);
    assert.deepEqual((await call('GET', '/review/3')).body, { bob: 'Too long' });

    assert.equal((await call('DELETE', '/customer/auth/review/3', { cookie: alice })).status, 404);
    assert.equal((await call('PUT', '/customer/auth/review/99?review=Hi', { cookie: alice })).status, 404);
    assert.equal((await call('PUT', '/customer/auth/review/3?review=%20%20', { cookie: alice })).status, 400);
});

test('logging out ends the session', async () => {
    const cookie = await registerAndLogin('carol');
    assert.equal((await call('POST', '/customer/logout', { cookie })).status, 200);
    assert.equal((await call('PUT', '/customer/auth/review/1?review=Hi', { cookie })).status, 401);
});

test('answers bad JSON and unknown routes with JSON errors', async () => {
    const badJson = await call('POST', '/register', { json: '{"username":' });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.message, 'The request body is not valid JSON.');

    const unknown = await call('GET', '/nothing/here');
    assert.equal(unknown.status, 404);
});

test('the async client returns the same data', async () => {
    assert.equal(Object.keys(await client.getAllBooks()).length, 10);
    assert.equal((await client.getBookByIsbn('1')).title, 'Things Fall Apart');
    assert.equal((await client.getBooksByAuthor('Jane Austen'))[0].isbn, '8');
    assert.equal((await client.getBooksByTitle('pride and prejudice'))[0].author, 'Jane Austen');
    await assert.rejects(client.getBookByIsbn('99'), /No book with ISBN 99/);
});
