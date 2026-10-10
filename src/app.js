const express = require('express');
const cors = require('cors');
const swaggerSpec = require('./swagger');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI is loaded from a CDN so it also works on serverless hosts (e.g. Vercel),
// where locally served static assets are not always bundled with the function.
const SWAGGER_UI_VERSION = '5.17.14';
const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Playlist API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/swagger.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;

app.get(['/swagger', '/swagger/'], (req, res) => res.type('html').send(swaggerHtml));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

// Root redirects to Swagger so the public URL opens the docs directly
app.get('/', (req, res) => res.redirect('/swagger'));

app.get('/health', (req, res) => res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));

app.use('/api', routes);

// Invalid JSON body
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

module.exports = app;
