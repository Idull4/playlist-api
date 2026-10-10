const express = require('express');
const { db, createSong, createPlaylist, addToPlaylist, now } = require('./db');

const router = express.Router();

// ---------- helpers ----------
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}
function notFound(res, message) {
  return res.status(404).json({ error: message });
}
function conflict(res, message) {
  return res.status(409).json({ error: message });
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
// 212 -> "3:32"
function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
// 1046 -> "17 min 26 sec"
function formatTotal(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h} hr`);
  if (h || m) parts.push(`${m} min`);
  parts.push(`${seconds % 60} sec`);
  return parts.join(' ');
}
function getSong(id) {
  return db.songs.find((s) => s.id === id);
}

// Library song as returned by the API: stored fields + formatted duration + the playlists it is in
function songView(song) {
  return {
    ...song,
    durationFormatted: formatDuration(song.durationSeconds),
    playlistIds: db.playlists.filter((p) => p.items.some((i) => i.songId === song.id)).map((p) => p.id),
  };
}
// Songs of a playlist in playlist order: song fields + 1-based position + when it was added to this playlist
function playlistSongs(playlist) {
  return playlist.items.map((item, index) => {
    const song = getSong(item.songId);
    return {
      ...song,
      durationFormatted: formatDuration(song.durationSeconds),
      position: index + 1,
      addedAt: item.addedAt,
    };
  });
}
function summary(playlist) {
  const total = playlist.items.reduce((sum, i) => sum + getSong(i.songId).durationSeconds, 0);
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    isPublic: playlist.isPublic,
    songCount: playlist.items.length,
    totalDurationSeconds: total,
    totalDurationFormatted: formatTotal(total),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}
function playlistView(playlist) {
  return { ...summary(playlist), songs: playlistSongs(playlist) };
}
function genresOf(songs) {
  return [...new Set(songs.map((s) => s.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function findPlaylist(req, res) {
  const playlist = db.playlists.find((p) => p.id === Number(req.params.playlistId));
  if (!playlist) notFound(res, `Playlist ${req.params.playlistId} not found`);
  return playlist;
}
function findSong(req, res) {
  const song = getSong(Number(req.params.songId));
  if (!song) notFound(res, `Song ${req.params.songId} not found`);
  return song;
}
// Index of the song inside the playlist, or -1 (after sending 404)
function findItemIndex(playlist, req, res) {
  const index = playlist.items.findIndex((i) => i.songId === Number(req.params.songId));
  if (index === -1) notFound(res, `Song ${req.params.songId} is not in playlist ${playlist.id}`);
  return index;
}

// Same title + artist (case-insensitive) counts as a duplicate; excludeId skips the song being updated
function isDuplicate(title, artist, excludeId) {
  const t = title.trim().toLowerCase();
  const a = artist.trim().toLowerCase();
  return db.songs.some((s) => s.id !== excludeId && s.title.toLowerCase() === t && s.artist.toLowerCase() === a);
}
function validateSong(body, partial = false) {
  const { title, artist, album, genre, coverUrl, durationSeconds, isFavorite } = body || {};
  if (!partial || title !== undefined) {
    if (!isNonEmptyString(title)) return 'title is required and must be a non-empty string';
  }
  if (!partial || artist !== undefined) {
    if (!isNonEmptyString(artist)) return 'artist is required and must be a non-empty string';
  }
  if (album !== undefined && typeof album !== 'string') return 'album must be a string';
  if (genre !== undefined && typeof genre !== 'string') return 'genre must be a string';
  if (coverUrl !== undefined) {
    if (typeof coverUrl !== 'string') return 'coverUrl must be a string';
    if (coverUrl !== '' && !/^https?:\/\//i.test(coverUrl)) return 'coverUrl must be an http(s) URL';
  }
  if (!partial || durationSeconds !== undefined) {
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return 'durationSeconds is required and must be a positive integer';
    }
  }
  if (isFavorite !== undefined && typeof isFavorite !== 'boolean') return 'isFavorite must be a boolean';
  return null;
}
function validatePlaylist(body, partial = false) {
  const { name, description, isPublic } = body || {};
  if (!partial || name !== undefined) {
    if (!isNonEmptyString(name)) return 'name is required and must be a non-empty string';
  }
  if (description !== undefined && typeof description !== 'string') return 'description must be a string';
  if (isPublic !== undefined && typeof isPublic !== 'boolean') return 'isPublic must be a boolean';
  return null;
}

const byText = (field) => (a, b) => a[field].localeCompare(b[field], undefined, { sensitivity: 'base' });
const SORTERS = {
  position: (a, b) => a.position - b.position,
  title: byText('title'),
  artist: byText('artist'),
  duration: (a, b) => a.durationSeconds - b.durationSeconds,
};

// Applies ?search, ?artist, ?genre, ?favorite, ?sortBy, ?order to a list of songs.
// Returns null (after sending 400) when sortBy/order is invalid.
function querySongs(songs, query, res, sortFields, defaultSort) {
  const { search, artist, genre, favorite, sortBy = defaultSort, order = 'asc' } = query;
  if (!sortFields.includes(sortBy)) {
    badRequest(res, `sortBy must be one of: ${sortFields.join(', ')}`);
    return null;
  }
  if (order !== 'asc' && order !== 'desc') {
    badRequest(res, 'order must be asc or desc');
    return null;
  }
  let result = songs;
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((s) => [s.title, s.artist, s.album].some((v) => v.toLowerCase().includes(q)));
  }
  if (artist) {
    const q = String(artist).toLowerCase();
    result = result.filter((s) => s.artist.toLowerCase().includes(q));
  }
  if (genre) {
    const g = String(genre).toLowerCase();
    result = result.filter((s) => s.genre.toLowerCase() === g);
  }
  if (favorite === 'true' || favorite === 'false') {
    result = result.filter((s) => s.isFavorite === (favorite === 'true'));
  }
  const compare = SORTERS[sortBy];
  return [...result].sort(order === 'asc' ? compare : (a, b) => compare(b, a));
}

// ---------- song library ----------
router.get('/songs', (req, res) => {
  const songs = querySongs(db.songs.map(songView), req.query, res, ['title', 'artist', 'duration'], 'title');
  if (songs) res.json(songs);
});

router.post('/songs', (req, res) => {
  const error = validateSong(req.body);
  if (error) return badRequest(res, error);
  const { title, artist, album, genre, coverUrl, durationSeconds, isFavorite } = req.body;
  if (isDuplicate(title, artist)) return conflict(res, 'This song is already in the library');
  const song = createSong({
    title: title.trim(),
    artist: artist.trim(),
    album,
    genre: genre?.trim(),
    coverUrl,
    durationSeconds,
    isFavorite,
  });
  res.status(201).json(songView(song));
});

router.get('/songs/:songId', (req, res) => {
  const song = findSong(req, res);
  if (song) res.json(songView(song));
});

router.put('/songs/:songId', (req, res) => {
  const song = findSong(req, res);
  if (!song) return;
  const error = validateSong(req.body, true);
  if (error) return badRequest(res, error);
  const { title, artist, album, genre, coverUrl, durationSeconds, isFavorite } = req.body;
  if (isDuplicate(title ?? song.title, artist ?? song.artist, song.id)) {
    return conflict(res, 'Another song with the same title and artist is already in the library');
  }
  if (title !== undefined) song.title = title.trim();
  if (artist !== undefined) song.artist = artist.trim();
  if (album !== undefined) song.album = album;
  if (genre !== undefined) song.genre = genre.trim();
  if (coverUrl !== undefined) song.coverUrl = coverUrl;
  if (durationSeconds !== undefined) song.durationSeconds = durationSeconds;
  if (isFavorite !== undefined) song.isFavorite = isFavorite;
  res.json(songView(song));
});

router.patch('/songs/:songId/favorite', (req, res) => {
  const song = findSong(req, res);
  if (!song) return;
  song.isFavorite = !song.isFavorite;
  res.json(songView(song));
});

// Deleting from the library also removes the song from every playlist
router.delete('/songs/:songId', (req, res) => {
  const song = findSong(req, res);
  if (!song) return;
  db.songs = db.songs.filter((s) => s.id !== song.id);
  for (const playlist of db.playlists) {
    const before = playlist.items.length;
    playlist.items = playlist.items.filter((i) => i.songId !== song.id);
    if (playlist.items.length !== before) playlist.updatedAt = now();
  }
  res.status(204).send();
});

router.get('/genres', (req, res) => {
  res.json(genresOf(db.songs));
});

// ---------- playlists ----------
router.get('/playlists', (req, res) => {
  let list = db.playlists;
  const { search, isPublic } = req.query;
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (isPublic === 'true' || isPublic === 'false') {
    list = list.filter((p) => p.isPublic === (isPublic === 'true'));
  }
  res.json(list.map(summary));
});

router.post('/playlists', (req, res) => {
  const error = validatePlaylist(req.body);
  if (error) return badRequest(res, error);
  const { name, description, isPublic } = req.body;
  const playlist = createPlaylist({ name: name.trim(), description, isPublic });
  res.status(201).json(playlistView(playlist));
});

router.get('/playlists/:playlistId', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (playlist) res.json(playlistView(playlist));
});

router.put('/playlists/:playlistId', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const error = validatePlaylist(req.body, true);
  if (error) return badRequest(res, error);
  const { name, description, isPublic } = req.body;
  if (name !== undefined) playlist.name = name.trim();
  if (description !== undefined) playlist.description = description;
  if (isPublic !== undefined) playlist.isPublic = isPublic;
  playlist.updatedAt = now();
  res.json(playlistView(playlist));
});

// Deleting a playlist keeps its songs in the library
router.delete('/playlists/:playlistId', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  db.playlists = db.playlists.filter((p) => p.id !== playlist.id);
  res.status(204).send();
});

// ---------- songs in a playlist ----------
router.get('/playlists/:playlistId/songs', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const songs = querySongs(playlistSongs(playlist), req.query, res, ['position', 'title', 'artist', 'duration'], 'position');
  if (songs) res.json(songs);
});

// Add an existing library song to the playlist (optionally at a given position)
router.post('/playlists/:playlistId/songs', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const { songId, position } = req.body || {};
  if (!Number.isInteger(songId)) return badRequest(res, 'songId is required and must be an integer');
  const maxPosition = playlist.items.length + 1;
  if (position !== undefined && (!Number.isInteger(position) || position < 1 || position > maxPosition)) {
    return badRequest(res, `position must be an integer between 1 and ${maxPosition}`);
  }
  if (!getSong(songId)) return notFound(res, `Song ${songId} not found in the library`);
  if (playlist.items.some((i) => i.songId === songId)) return conflict(res, 'This song is already in the playlist');
  addToPlaylist(playlist, songId, position);
  res.status(201).json(playlistSongs(playlist).find((s) => s.id === songId));
});

// Remove a song from the playlist; the song stays in the library
router.delete('/playlists/:playlistId/songs/:songId', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const index = findItemIndex(playlist, req, res);
  if (index === -1) return;
  playlist.items.splice(index, 1);
  playlist.updatedAt = now();
  res.status(204).send();
});

// Move a song to a new 1-based position (drag & drop reordering); returns the songs in the new order
router.patch('/playlists/:playlistId/songs/:songId/position', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const index = findItemIndex(playlist, req, res);
  if (index === -1) return;
  const { position } = req.body || {};
  const count = playlist.items.length;
  if (!Number.isInteger(position) || position < 1 || position > count) {
    return badRequest(res, `position must be an integer between 1 and ${count}`);
  }
  const [item] = playlist.items.splice(index, 1);
  playlist.items.splice(position - 1, 0, item);
  playlist.updatedAt = now();
  res.json(playlistSongs(playlist));
});

// Distinct genres in the playlist (for an "All Genres" filter)
router.get('/playlists/:playlistId/genres', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (playlist) res.json(genresOf(playlistSongs(playlist)));
});

// Shuffle: returns the songs in random order without changing the stored order
router.get('/playlists/:playlistId/shuffle', (req, res) => {
  const playlist = findPlaylist(req, res);
  if (!playlist) return;
  const songs = playlistSongs(playlist);
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  res.json(songs);
});

module.exports = router;
