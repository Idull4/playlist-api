// OpenAPI 3.0 specification for the Playlist API

const idParam = (name, desc) => ({
  name,
  in: 'path',
  required: true,
  description: desc,
  schema: { type: 'integer', example: 1 },
});

const errorResponse = (desc) => ({
  description: desc,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (ref) => ({ 'application/json': { schema: { $ref: ref } } });
const jsonArray = (ref) => ({ 'application/json': { schema: { type: 'array', items: { $ref: ref } } } });
const stringArray = (example) => ({ 'application/json': { schema: { type: 'array', items: { type: 'string' }, example } } });

// Query parameters shared by the library and the playlist song lists
const songQueryParams = (sortFields, defaultSort) => [
  { name: 'search', in: 'query', description: 'Search in title, artist or album', schema: { type: 'string' }, example: 'weeknd' },
  { name: 'artist', in: 'query', description: 'Filter by artist name', schema: { type: 'string' } },
  { name: 'genre', in: 'query', description: 'Filter by genre (exact, case-insensitive)', schema: { type: 'string' } },
  { name: 'favorite', in: 'query', description: 'Filter by favorite status', schema: { type: 'boolean' } },
  { name: 'sortBy', in: 'query', description: 'Sort field', schema: { type: 'string', enum: sortFields, default: defaultSort } },
  { name: 'order', in: 'query', description: 'Sort direction', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Playlist API',
    version: '2.0.0',
    description:
      '**SE4458 – Assignment 2** · Group 2 – Playlist · Mert Aydul · ' +
      '[Source code](https://github.com/Idull4/playlist-api)\n\n' +
      'A simple REST API for managing a music library and playlists.\n\n' +
      '- **Songs** live in a shared library.\n' +
      '- **Playlists** reference library songs in a custom order; one song can be in several playlists.\n' +
      '- Removing a song from a playlist keeps it in the library; deleting it from the library removes it from every playlist.\n\n' +
      'All data is stored in an in-memory database and resets when the server restarts.',
  },
  tags: [
    { name: 'Songs', description: 'The song library' },
    { name: 'Playlists', description: 'Create and manage playlists' },
    { name: 'Playlist Songs', description: 'Add, remove, reorder and browse the songs of a playlist' },
    { name: 'Health', description: 'Service status' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' }, uptimeSeconds: { type: 'number' } },
                },
              },
            },
          },
        },
      },
    },

    // ---------- song library ----------
    '/api/songs': {
      get: {
        tags: ['Songs'],
        summary: 'List library songs (search, filter, sort)',
        parameters: songQueryParams(['title', 'artist', 'duration'], 'title'),
        responses: {
          200: { description: 'Library songs', content: jsonArray('#/components/schemas/Song') },
          400: errorResponse('Invalid sortBy or order'),
        },
      },
      post: {
        tags: ['Songs'],
        summary: 'Add a song to the library',
        requestBody: { required: true, content: json('#/components/schemas/SongInput') },
        responses: {
          201: { description: 'Song created', content: json('#/components/schemas/Song') },
          400: errorResponse('Validation error'),
          409: errorResponse('A song with the same title and artist already exists'),
        },
      },
    },
    '/api/songs/{songId}': {
      parameters: [idParam('songId', 'Song ID')],
      get: {
        tags: ['Songs'],
        summary: 'Get a library song',
        responses: {
          200: { description: 'The song', content: json('#/components/schemas/Song') },
          404: errorResponse('Song not found'),
        },
      },
      put: {
        tags: ['Songs'],
        summary: 'Update a library song',
        description: 'Only the fields you send are updated. Changes are visible in every playlist that contains the song.',
        requestBody: { required: true, content: json('#/components/schemas/SongUpdate') },
        responses: {
          200: { description: 'Updated song', content: json('#/components/schemas/Song') },
          400: errorResponse('Validation error'),
          404: errorResponse('Song not found'),
          409: errorResponse('Another song with the same title and artist already exists'),
        },
      },
      delete: {
        tags: ['Songs'],
        summary: 'Delete a song from the library',
        description: 'Also removes the song from every playlist.',
        responses: { 204: { description: 'Deleted' }, 404: errorResponse('Song not found') },
      },
    },
    '/api/songs/{songId}/favorite': {
      parameters: [idParam('songId', 'Song ID')],
      patch: {
        tags: ['Songs'],
        summary: 'Toggle favorite status of a song',
        responses: {
          200: { description: 'Updated song', content: json('#/components/schemas/Song') },
          404: errorResponse('Song not found'),
        },
      },
    },
    '/api/genres': {
      get: {
        tags: ['Songs'],
        summary: 'List the distinct genres in the library',
        responses: { 200: { description: 'Genres, sorted alphabetically', content: stringArray(['Pop', 'R&B']) } },
      },
    },

    // ---------- playlists ----------
    '/api/playlists': {
      get: {
        tags: ['Playlists'],
        summary: 'List all playlists',
        parameters: [
          { name: 'search', in: 'query', description: 'Filter by name or description', schema: { type: 'string' } },
          { name: 'isPublic', in: 'query', description: 'Filter by visibility', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'List of playlists', content: jsonArray('#/components/schemas/PlaylistSummary') } },
      },
      post: {
        tags: ['Playlists'],
        summary: 'Create a playlist',
        requestBody: { required: true, content: json('#/components/schemas/PlaylistInput') },
        responses: {
          201: { description: 'Playlist created', content: json('#/components/schemas/Playlist') },
          400: errorResponse('Validation error'),
        },
      },
    },
    '/api/playlists/{playlistId}': {
      parameters: [idParam('playlistId', 'Playlist ID')],
      get: {
        tags: ['Playlists'],
        summary: 'Get a playlist with its songs',
        responses: {
          200: { description: 'The playlist', content: json('#/components/schemas/Playlist') },
          404: errorResponse('Playlist not found'),
        },
      },
      put: {
        tags: ['Playlists'],
        summary: 'Update a playlist',
        description: 'Only the fields you send are updated.',
        requestBody: { required: true, content: json('#/components/schemas/PlaylistUpdate') },
        responses: {
          200: { description: 'Updated playlist', content: json('#/components/schemas/Playlist') },
          400: errorResponse('Validation error'),
          404: errorResponse('Playlist not found'),
        },
      },
      delete: {
        tags: ['Playlists'],
        summary: 'Delete a playlist',
        description: 'Its songs stay in the library.',
        responses: { 204: { description: 'Deleted' }, 404: errorResponse('Playlist not found') },
      },
    },

    // ---------- songs in a playlist ----------
    '/api/playlists/{playlistId}/songs': {
      parameters: [idParam('playlistId', 'Playlist ID')],
      get: {
        tags: ['Playlist Songs'],
        summary: 'List the songs of a playlist (search, filter, sort)',
        parameters: songQueryParams(['position', 'title', 'artist', 'duration'], 'position'),
        responses: {
          200: { description: 'Songs of the playlist', content: jsonArray('#/components/schemas/PlaylistSong') },
          400: errorResponse('Invalid sortBy or order'),
          404: errorResponse('Playlist not found'),
        },
      },
      post: {
        tags: ['Playlist Songs'],
        summary: 'Add a library song to the playlist',
        requestBody: { required: true, content: json('#/components/schemas/PlaylistSongInput') },
        responses: {
          201: { description: 'Song added to the playlist', content: json('#/components/schemas/PlaylistSong') },
          400: errorResponse('Invalid songId or position'),
          404: errorResponse('Playlist or library song not found'),
          409: errorResponse('Song already in the playlist'),
        },
      },
    },
    '/api/playlists/{playlistId}/songs/{songId}': {
      parameters: [idParam('playlistId', 'Playlist ID'), idParam('songId', 'Song ID')],
      delete: {
        tags: ['Playlist Songs'],
        summary: 'Remove a song from the playlist',
        description: 'The song stays in the library.',
        responses: { 204: { description: 'Removed' }, 404: errorResponse('Playlist not found or song not in playlist') },
      },
    },
    '/api/playlists/{playlistId}/songs/{songId}/position': {
      parameters: [idParam('playlistId', 'Playlist ID'), idParam('songId', 'Song ID')],
      patch: {
        tags: ['Playlist Songs'],
        summary: 'Move a song to a new position (drag & drop reordering)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['position'], properties: { position: { type: 'integer', minimum: 1, example: 3 } } },
            },
          },
        },
        responses: {
          200: { description: 'All songs of the playlist in the new order', content: jsonArray('#/components/schemas/PlaylistSong') },
          400: errorResponse('Position out of range'),
          404: errorResponse('Playlist not found or song not in playlist'),
        },
      },
    },
    '/api/playlists/{playlistId}/genres': {
      parameters: [idParam('playlistId', 'Playlist ID')],
      get: {
        tags: ['Playlist Songs'],
        summary: 'List the distinct genres in a playlist',
        responses: {
          200: { description: 'Genres, sorted alphabetically', content: stringArray(['Pop', 'R&B']) },
          404: errorResponse('Playlist not found'),
        },
      },
    },
    '/api/playlists/{playlistId}/shuffle': {
      parameters: [idParam('playlistId', 'Playlist ID')],
      get: {
        tags: ['Playlist Songs'],
        summary: 'Get the playlist songs in random order',
        description: 'The stored order is not changed.',
        responses: {
          200: { description: 'Shuffled songs', content: jsonArray('#/components/schemas/PlaylistSong') },
          404: errorResponse('Playlist not found'),
        },
      },
    },
  },
  components: {
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string', example: 'Playlist 99 not found' } } },
      Song: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', example: 'Blinding Lights' },
          artist: { type: 'string', example: 'The Weeknd' },
          album: { type: 'string', example: 'After Hours' },
          genre: { type: 'string', example: 'Pop' },
          coverUrl: { type: 'string', example: 'https://placehold.co/300x300?text=Blinding%20Lights' },
          durationSeconds: { type: 'integer', example: 212 },
          durationFormatted: { type: 'string', example: '3:32' },
          isFavorite: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          playlistIds: { type: 'array', items: { type: 'integer' }, description: 'Playlists that contain this song', example: [1] },
        },
      },
      PlaylistSong: {
        type: 'object',
        description: 'A library song as it appears in a playlist',
        properties: {
          id: { type: 'integer', example: 1 },
          position: { type: 'integer', description: '1-based position in the playlist', example: 1 },
          title: { type: 'string', example: 'Blinding Lights' },
          artist: { type: 'string', example: 'The Weeknd' },
          album: { type: 'string', example: 'After Hours' },
          genre: { type: 'string', example: 'Pop' },
          coverUrl: { type: 'string', example: 'https://placehold.co/300x300?text=Blinding%20Lights' },
          durationSeconds: { type: 'integer', example: 212 },
          durationFormatted: { type: 'string', example: '3:32' },
          isFavorite: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time', description: 'When the song was added to the library' },
          addedAt: { type: 'string', format: 'date-time', description: 'When the song was added to this playlist' },
        },
      },
      SongInput: {
        type: 'object',
        required: ['title', 'artist', 'durationSeconds'],
        properties: {
          title: { type: 'string', example: 'Stay' },
          artist: { type: 'string', example: 'The Kid LAROI & Justin Bieber' },
          album: { type: 'string', example: 'F*CK LOVE 3' },
          genre: { type: 'string', example: 'Pop' },
          coverUrl: { type: 'string', description: 'Empty or an http(s) URL', example: 'https://placehold.co/300x300?text=Stay' },
          durationSeconds: { type: 'integer', minimum: 1, example: 141 },
          isFavorite: { type: 'boolean', example: false },
        },
      },
      SongUpdate: {
        type: 'object',
        properties: {
          title: { type: 'string', example: 'Levitating (feat. DaBaby)' },
          artist: { type: 'string', example: 'Dua Lipa' },
          album: { type: 'string', example: 'Future Nostalgia' },
          genre: { type: 'string', example: 'Dance' },
          coverUrl: { type: 'string', example: 'https://placehold.co/300x300?text=Levitating' },
          durationSeconds: { type: 'integer', minimum: 1, example: 203 },
          isFavorite: { type: 'boolean', example: true },
        },
      },
      PlaylistSongInput: {
        type: 'object',
        required: ['songId'],
        properties: {
          songId: { type: 'integer', description: 'ID of a library song', example: 6 },
          position: { type: 'integer', minimum: 1, description: 'Where to insert (1-based). Defaults to the end.', example: 1 },
        },
      },
      PlaylistSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Group 2 Playlist' },
          description: { type: 'string', example: 'Our favorite pop and R&B hits' },
          isPublic: { type: 'boolean', example: true },
          songCount: { type: 'integer', example: 5 },
          totalDurationSeconds: { type: 'integer', example: 1046 },
          totalDurationFormatted: { type: 'string', example: '17 min 26 sec' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Playlist: {
        allOf: [
          { $ref: '#/components/schemas/PlaylistSummary' },
          { type: 'object', properties: { songs: { type: 'array', items: { $ref: '#/components/schemas/PlaylistSong' } } } },
        ],
      },
      PlaylistInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Workout Mix' },
          description: { type: 'string', example: 'High energy songs' },
          isPublic: { type: 'boolean', example: true },
        },
      },
      PlaylistUpdate: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Workout Mix 2026' },
          description: { type: 'string', example: 'Updated description' },
          isPublic: { type: 'boolean', example: false },
        },
      },
    },
  },
};
