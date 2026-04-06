# CSCI 3916 — Assignment Four (Movies & Reviews API)

postman tests folder location : [postman/](postman/)

render link: https://csci3916-hw4-s598.onrender.com

The Extra credit google analytics report has been added as a pdf [Extra credit event report](Event_report_GA.pdf)

## Project

This project is a Node.js / Express REST API that builds on the previous assignments to manage a `movies` collection and a separate `reviews` collection in MongoDB. Reviews are stored independently and can be optionally included in movie responses using the query parameter `?reviews=true`. The API supports listing movies, retrieving a single movie (optionally with reviews), creating reviews (JWT-protected), and basic analytics hooks (extra credit) to report which movies are requested.

## Features

- Movies stored in a MongoDB collection
- Reviews stored in a separate MongoDB collection and linked by `movieId`
- Optional aggregated responses using MongoDB `$lookup` or Async.js
- JWT-protected POST for creating reviews (username from token recorded)
- Postman test collection included (paste your embed link below)

---

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create an `.env` file in the project root with the environment variables shown below.

3. Start the server locally:

```bash
node server.js
```

---

## Environment variables

Create a file named `.env` in the project root with these keys (example values shown):

```
MONGODB_URI=
JWT_SECRET=
GA_KEY =
GA_SECRET =
```
