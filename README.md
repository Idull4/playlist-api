# Playlist API

A simple REST API for managing a music library and playlists, built with **Node.js + Express**.
Data is kept in an **in-memory database** (resets on restart). API docs are served with **Swagger UI**.

**Library model:** songs live in a shared library; playlists reference library songs in a custom order.
One song can be in several playlists. Removing a song from a playlist keeps it in the library;
deleting it from the library removes it from every playlist.

## Run locally

```bash
npm install
npm start
```

- Swagger UI: http://localhost:3000/swagger
- OpenAPI JSON: http://localhost:3000/swagger.json

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| **Songs (library)** | | |
| GET | `/api/songs?search=&artist=&genre=&favorite=&sortBy=&order=` | List library songs (search, filter, sort) |
| POST | `/api/songs` | Add a song to the library |
| GET | `/api/songs/{songId}` | Get a song (incl. the playlists it is in) |
| PUT | `/api/songs/{songId}` | Update a song |
| PATCH | `/api/songs/{songId}/favorite` | Toggle favorite |
| DELETE | `/api/songs/{songId}` | Delete from the library (and every playlist) |
| GET | `/api/genres` | Distinct genres in the library |
| **Playlists** | | |
| GET | `/api/playlists?search=&isPublic=` | List playlists (with filters) |
| POST | `/api/playlists` | Create a playlist |
| GET | `/api/playlists/{id}` | Get a playlist with its songs |
| PUT | `/api/playlists/{id}` | Update a playlist |
| DELETE | `/api/playlists/{id}` | Delete a playlist (songs stay in the library) |
| **Playlist songs** | | |
| GET | `/api/playlists/{id}/songs?search=&artist=&genre=&favorite=&sortBy=&order=` | List the playlist's songs (search, filter, sort) |
| POST | `/api/playlists/{id}/songs` | Add a library song: `{ "songId": 6, "position": 1 }` (position optional) |
| DELETE | `/api/playlists/{id}/songs/{songId}` | Remove from the playlist (stays in the library) |
| PATCH | `/api/playlists/{id}/songs/{songId}/position` | Move a song (drag & drop reorder) |
| GET | `/api/playlists/{id}/genres` | Distinct genres in the playlist |
| GET | `/api/playlists/{id}/shuffle` | Songs in random order |

- **Search** matches title, artist or album. **sortBy**: `title` (library default), `artist`, `duration`, and for playlists also `position` (default); **order**: `asc` / `desc`.
- Each song has a genre, cover image URL, favorite flag and a formatted duration (`3:32`). In a playlist it also has its `position`.
- Each playlist reports its song count and total duration (`17 min 26 sec`).
- Input validation (400), not-found handling (404), duplicate checks (409).
- Seed data: 8 library songs, "Group 2 Playlist" (5 songs) and "Chill R&B" (2 songs).

## Project structure

```
api/index.js      Vercel serverless entry point (exports the Express app)
src/app.js        Express app: middleware, Swagger UI, routes, error handling
src/server.js     Local entry point (app.listen on port 3000)
src/routes.js     Playlist and song endpoints
src/db.js         In-memory database with seed data
src/swagger.js    OpenAPI 3.0 specification
vercel.json       Routes every request to api/index.js
```

## Deploy to Vercel

**Option A – from GitHub**

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com/new → import the repository.
3. Leave all settings at their defaults (Framework Preset: **Other**) and click **Deploy**.
4. Open `https://<your-project>.vercel.app/swagger`.

**Option B – from the command line**

```bash
npx vercel login
npx vercel --prod
```

Note: Vercel runs the app as a serverless function. Because the database is in memory,
data resets when the function instance is recycled (e.g. after inactivity or a new deployment),
and parallel instances do not share data.
