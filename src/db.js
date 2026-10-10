// In-memory database. All data lives in RAM and resets when the server restarts.
//
// Library model: songs live in a shared library (db.songs). A playlist does not own songs,
// it only references them through an ordered list of items ({ songId, addedAt }).
// The same song can be in several playlists; removing it from a playlist keeps it in the library.

const db = {
  songs: [],
  playlists: [],
  nextSongId: 1,
  nextPlaylistId: 1,
};

function now() {
  return new Date().toISOString();
}

function createSong({ title, artist, album = '', genre = '', coverUrl = '', durationSeconds, isFavorite = false }) {
  const song = {
    id: db.nextSongId++,
    title,
    artist,
    album,
    genre,
    coverUrl,
    durationSeconds,
    isFavorite,
    createdAt: now(),
  };
  db.songs.push(song);
  return song;
}

function createPlaylist({ name, description = '', isPublic = true }) {
  const playlist = {
    id: db.nextPlaylistId++,
    name,
    description,
    isPublic,
    createdAt: now(),
    updatedAt: now(),
    items: [],
  };
  db.playlists.push(playlist);
  return playlist;
}

// position is 1-based; when omitted the song is appended to the end
function addToPlaylist(playlist, songId, position = playlist.items.length + 1) {
  const item = { songId, addedAt: now() };
  playlist.items.splice(position - 1, 0, item);
  playlist.updatedAt = now();
  return item;
}

function cover(text) {
  return `https://placehold.co/300x300?text=${encodeURIComponent(text)}`;
}

function seed() {
  const song = (title, artist, album, genre, durationSeconds, isFavorite = false) =>
    createSong({ title, artist, album, genre, coverUrl: cover(title), durationSeconds, isFavorite });

  const blindingLights = song('Blinding Lights', 'The Weeknd', 'After Hours', 'Pop', 212, true);
  const levitating = song('Levitating', 'Dua Lipa', 'Future Nostalgia', 'Pop', 220);
  const watermelonSugar = song('Watermelon Sugar', 'Harry Styles', 'Fine Line', 'Pop', 214, true);
  const saveYourTears = song('Save Your Tears', 'The Weeknd', 'After Hours', 'R&B', 246);
  const peaches = song('Peaches', 'Justin Bieber', 'Justice', 'Pop', 154, true);
  // In the library but not in "Group 2 Playlist"
  song('As It Was', 'Harry Styles', "Harry's House", 'Pop', 167);
  const kissMeMore = song('Kiss Me More', 'Doja Cat', 'Planet Her', 'R&B', 208);
  song('Bad Habits', 'Ed Sheeran', '=', 'Pop', 231);

  const group2 = createPlaylist({ name: 'Group 2 Playlist', description: 'Our favorite pop and R&B hits', isPublic: true });
  for (const s of [blindingLights, levitating, watermelonSugar, saveYourTears, peaches]) addToPlaylist(group2, s.id);

  // Shows that one song can be in several playlists
  const chill = createPlaylist({ name: 'Chill R&B', description: 'Slow evening vibes', isPublic: false });
  for (const s of [saveYourTears, kissMeMore]) addToPlaylist(chill, s.id);
}

seed();

module.exports = { db, createSong, createPlaylist, addToPlaylist, now };
