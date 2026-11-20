# Book Reviews API

[![CI](https://github.com/AnnaTverdovska/expressBookReviews/actions/workflows/ci.yml/badge.svg)](https://github.com/AnnaTverdovska/expressBookReviews/actions/workflows/ci.yml)

A REST API for a small online bookshop, built with Node.js and Express. Anyone can browse the
books and read reviews. Registered users log in and can write, update and delete their own
reviews.

The project started from IBM Skills Network's template for the final project of IBM's
*Developing Back-End Apps with Node.js and Express* course.

## Endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| `GET` | `/` | everyone | All books, keyed by ISBN |
| `GET` | `/isbn/:isbn` | everyone | One book, or `404` |
| `GET` | `/author/:author` | everyone | Books by that author (exact name, any case) |
| `GET` | `/title/:title` | everyone | Books with that title (exact title, any case) |
| `GET` | `/review/:isbn` | everyone | The reviews of one book |
| `POST` | `/register` | everyone | Create an account: `{"username": "...", "password": "..."}` |
| `POST` | `/customer/login` | registered users | Log in; starts a session |
| `POST` | `/customer/logout` | logged in | End the session |
| `PUT` | `/customer/auth/review/:isbn` | logged in | Add or update your review: `?review=...` or `{"review": "..."}` |
| `DELETE` | `/customer/auth/review/:isbn` | logged in | Delete your own review |

Errors come back as JSON with a `message` that says what to change, and the usual status codes:
`400` for missing or invalid input, `401` when a login is needed or failed, `404` for unknown
books and routes, `409` for a username that is taken.

## How it works

- **Login:** `POST /customer/login` checks the password and signs a JSON Web Token that is valid
  for one hour. The token is stored in the server-side session, so the client only keeps a
  session cookie. Every request under `/customer/auth` is checked by a small middleware in
  `index.js` that verifies the token.
- **Passwords:** stored as salted scrypt hashes and compared in constant time, never as plain text.
- **Secrets:** read from the `JWT_SECRET` and `SESSION_SECRET` environment variables. Without
  them, random secrets are generated at each start, so there is no well-known secret in the
  code.
- **Data:** the books are in `router/booksdb.js`. Users, reviews and sessions live in memory and
  reset when the server restarts; a real deployment would use a database and a session store.
- **Async client:** `client.js` fetches books from the running API, once with `async`/`await`
  and once as a Promise chain.

```
final_project/
├── index.js             app setup, authentication middleware, error handling
├── config.js            secrets and token lifetime
├── client.js            async client for the API
├── router/
│   ├── general.js       public routes and registration
│   ├── auth_users.js    login, logout and reviews
│   └── booksdb.js       the book data
└── test/api.test.js     tests
```

## Running it

You need Node.js 22 or newer.

```bash
cd final_project
npm ci          # install the exact versions from package-lock.json
npm start       # API at http://localhost:5000 (set PORT to change it)
npm run dev     # the same, restarting when a file changes
npm test        # run the tests
```

## Trying it out

With the server running, in a second terminal (on Windows use `curl.exe`):

```bash
curl http://localhost:5000/isbn/1
curl "http://localhost:5000/author/jane%20austen"

curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" -d '{"username":"anna","password":"correct-horse"}'

# -c and -b keep the session cookie between requests
curl -c cookies.txt -X POST http://localhost:5000/customer/login \
  -H "Content-Type: application/json" -d '{"username":"anna","password":"correct-horse"}'

curl -b cookies.txt -X PUT "http://localhost:5000/customer/auth/review/1?review=A%20powerful%20read"
curl http://localhost:5000/review/1
curl -b cookies.txt -X DELETE http://localhost:5000/customer/auth/review/1
```

Adding the review answers:

```json
{
  "message": "Your review of \"Things Fall Apart\" was added.",
  "reviews": {
    "anna": "A powerful read"
  }
}
```

The async client works the same way:

```bash
node client.js author "Jane Austen"
node client.js title "Things Fall Apart"
```

## Tests

`final_project/test/api.test.js` has 11 tests for Node's built-in test runner, so no testing
library is needed. They start the server on a free port and send real HTTP requests. They cover:

- browsing and searching
- registration rules
- password hashing
- logging in and out
- protecting the review routes
- users only changing their own reviews
- error responses
- the async client

GitHub Actions runs them on Node.js 22 and 24 for every push
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). It installs the packages with
`npm ci --ignore-scripts`, so no package can run code during installation.

## Dependencies

Three packages, all at current versions: `express`, `express-session` and `jsonwebtoken`. The
template's `jsonwebtoken` 8.5 had known security problems, and its `nodemon` is replaced by
Node's built-in `--watch`. `npm audit` reports no known vulnerabilities.

## Changes to the IBM template

This repository is a modified version of IBM Skills Network's template
(`ibm-developer-skills-network/expressBookReviews`), licensed under the Apache License 2.0. The
template came with empty route handlers for the learner to complete. AnnaTverdovska made all
changes in 2026; the commit history shows each one in detail, and changed files that allow
comments say so in their first lines.

<details>
<summary>Files changed from the template (5)</summary>

- `README.md`
- `final_project/index.js`
- `final_project/package.json`: current dependencies, scripts, and the license field corrected
  from MIT to Apache-2.0 to match the repository's license
- `final_project/router/auth_users.js`
- `final_project/router/general.js`

</details>

<details>
<summary>Files added (5)</summary>

- `.github/workflows/ci.yml`
- `final_project/client.js`
- `final_project/config.js`
- `final_project/package-lock.json`
- `final_project/test/api.test.js`

</details>

<details>
<summary>Files removed (2)</summary>

- `.DS_Store`: a macOS folder settings file committed by mistake
- `final_project/README.md`: a one-line placeholder, replaced by this README

</details>

## License

[Apache License 2.0](LICENSE), the license of the original template: Copyright 2020 IBM
Developer Skills Network.
