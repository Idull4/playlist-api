# Group 2 Playlist API

A simple REST API for managing a music library and playlists, built with **Node.js + Express**.
Data is kept in an **in-memory database**. API docs are served with **Swagger UI**.

| | Link |
|---|---|
| Code | https://github.com/Idull4/playlist-api |
| Deployment | https://playlist-api-one.vercel.app/swagger |

## Design

### Architecture

```
Request ─► Vercel ─► api/index.js ─► src/app.js (Express)
                                        ├─ /swagger, /swagger.json  Swagger UI + OpenAPI spec
                                        ├─ /health                  Health check
                                        └─ /api/*                   src/routes.js ─► src/db.js (in memory)
```

```
api/index.js      Vercel serverless entry point (exports the Express app)
src/app.js        Express app: middleware, Swagger UI, routes, error handling
src/server.js     Local entry point (app.listen on port 3000)
src/routes.js     Song library, playlist and playlist-song endpoints
src/db.js         In-memory database with seed data
src/swagger.js    OpenAPI 3.0 specification
vercel.json       Routes every request to api/index.js
```

### Data model (library model)

Songs live in a shared **library**. A playlist does not own songs; it keeps an ordered list of
references to library songs. One song can be in several playlists.

```
Song      { id, title, artist, album, genre, coverUrl, durationSeconds, isFavorite, createdAt }
Playlist  { id, name, description, isPublic, createdAt, updatedAt, items: [{ songId, addedAt }] }
```

The order of `items` is the playlist order. Values that can be derived are calculated on every
response instead of being stored: a song's `position` in a playlist, `durationFormatted` (`3:32`),
a playlist's `songCount` and total duration (`17 min 26 sec`), and the `playlistIds` a song is in.

| Action | Effect |
|---|---|
| Remove a song from a playlist | The song stays in the library |
| Delete a song from the library | It is also removed from every playlist |
| Delete a playlist | Its songs stay in the library |

### Endpoints

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
| GET | `/api/playlists/{id}/shuffle` | Songs in random order (stored order is not changed) |

- **Search** matches title, artist or album. **sortBy**: `title` (library default), `artist`, `duration`,
  and for playlists also `position` (default). **order**: `asc` / `desc`.
- Errors are returned as `{ "error": "message" }` with **400** (validation, invalid JSON),
  **404** (not found) or **409** (duplicate).
- Seed data: 8 library songs, "Group 2 Playlist" (5 songs, 17 min 26 sec) and "Chill R&B" (2 songs).

### Mapping to the UI design

The API provides everything the Group 2 Playlist screen needs (no frontend is built, as required):

| UI element | API |
|---|---|
| "5 songs • 17 min 26 sec" | `songCount`, `totalDurationFormatted` |
| Search songs, artist, or album | `?search=` |
| Sort by Title / Artist / Duration | `?sortBy=title\|artist\|duration&order=asc\|desc` |
| All Genres filter | `GET /api/playlists/{id}/genres` + `?genre=` |
| `#` column and drag handle | `position` + `PATCH .../position` |
| Cover image, duration `3:32`, genre tag | `coverUrl`, `durationFormatted`, `genre` |
| Star (favorite) | `PATCH /api/songs/{songId}/favorite` |
| Pencil (edit) | `PUT /api/songs/{songId}` |
| Remove Song dialog | `DELETE /api/playlists/{id}/songs/{songId}` |
| `+` button | `POST /api/playlists/{id}/songs` (or `POST /api/songs` for a new song) |

## Assumptions

- **Single user, no authentication.** Anyone with the link can read and change the data.
- **In-memory data is acceptable to lose.** Data resets on restart, and the seed data comes back.
- **Favorite belongs to the song**, not to a playlist (like "Liked Songs"), so a favorite song is
  shown as favorite in every playlist.
- **Duplicates:** two songs with the same title and artist (case-insensitive, trimmed) are the same
  song, so the library rejects them with 409. A song can be in a playlist only once.
- **Durations** are whole seconds (`durationSeconds` > 0). Formatted values are derived from them.
- **Positions** are 1-based. Adding a song without a position appends it to the end.
- **Genre** is free text, and genre filtering is an exact, case-insensitive match.
- **Cover images** are only URLs (`http`/`https`). Seed data uses placeholder images; no files are stored.
- **No frontend** is needed (as stated in the assignment). The UI design is supported through the API.

## Issues encountered

| Issue | Solution |
|---|---|
| Node.js was not installed, and the `winget` installer failed with error 1603 (needs administrator rights). | Installed the official Node.js zip (checksum verified) in the user folder and added it to the user `PATH`. |
| The VS Code debug configuration started `src/db.js`, so the server never started. | Pointed `.vscode/launch.json` to `src/server.js`. |
| Updating a song could create a duplicate (the 409 check only ran when adding). | The same duplicate check now runs on create and update, ignoring the song being updated. |
| Vercel runs the app as a serverless function, so `app.listen()` cannot be used. | Split the app into `src/app.js` (exports the app) and `src/server.js` (local only); added `api/index.js` and `vercel.json`. |
| `swagger-ui-express` serves its CSS/JS from the function, which often shows a blank Swagger page on Vercel. | The `/swagger` page loads Swagger UI from a CDN (unpkg, pinned version) and reads `/swagger.json`. |
| After the first deploy, the site asked for a Vercel login ("Protected by Vercel Authentication"). | Disabled Deployment Protection in the Vercel project settings so the Swagger page is public. |
| The first model stored songs inside playlists, so "remove from playlist" and "delete song" meant the same thing. | Switched to a library model: songs in a shared library, playlists reference them. |
| In-memory data on serverless: instances are recycled after inactivity or a new deploy, and parallel instances don't share memory. | Accepted as part of the in-memory requirement and documented here. Seed data is restored on every cold start. |

## Testing

- **Functional:** 104 checks covering every endpoint, including search, filters, sorting, reordering,
  library/playlist behavior and all error cases (run locally on both entry points).
- **Schema:** the OpenAPI spec passes OpenAPI 3.0 validation; 132 checks confirm that real responses
  match the documented schemas exactly (no missing or extra fields), every documented status code is
  reached, and the Swagger "Try it out" examples work.
- **Live:** 44 checks on the Vercel deployment (read, error and write cases with temporary records that
  are cleaned up afterwards).

## Run locally

```bash
npm install
npm start
```

- Swagger UI: http://localhost:3000/swagger
- OpenAPI JSON: http://localhost:3000/swagger.json

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com/new and import the repository.
3. Leave all settings at their defaults (Framework Preset: **Other**) and click **Deploy**.
4. In **Settings → Deployment Protection**, turn off **Vercel Authentication** so the site is public.
5. Open `https://<your-project>.vercel.app/swagger`.

Every push to `main` is deployed automatically.
