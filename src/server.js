// Local entry point. On Vercel the app is served by api/index.js instead.
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Playlist API running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/swagger`);
});
