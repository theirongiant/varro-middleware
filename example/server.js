const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const VarroMiddleware = require('../index');

const app = express();
const port = 3456;

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Varro middleware
const varro = new VarroMiddleware();
app.use(varro.middleware());

// Sample API routes
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ]);
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    id: parseInt(id),
    name: `User ${id}`,
    email: `user${id}@example.com`
  });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({
    id: Math.floor(Math.random() * 1000),
    name,
    email,
    createdAt: new Date().toISOString()
  });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  res.json({
    id: parseInt(id),
    name,
    email,
    updatedAt: new Date().toISOString()
  });
});

app.delete('/api/users/:id', (req, res) => {
  res.status(204).send();
});

// Health check endpoint (excluded from recording)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Non-API route (excluded from recording)
app.get('/', (req, res) => {
  res.send(`
    <h1>Varro Middleware Example</h1>
    <p>Current mode: ${varro.config.mode}</p>
    <h2>Available endpoints:</h2>
    <ul>
      <li>GET /api/users - List all users</li>
      <li>GET /api/users/:id - Get user by ID</li>
      <li>POST /api/users - Create new user</li>
      <li>PUT /api/users/:id - Update user</li>
      <li>DELETE /api/users/:id - Delete user</li>
      <li>GET /api/health - Health check</li>
    </ul>
    <h2>Test the API:</h2>
    <p>Try making requests to the API endpoints above. Check the recordings directory to see recorded files.</p>
  `);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Varro mode: ${varro.config.mode}`);
  console.log(`Recordings directory: ${varro.config.recordingsDir}`);
});
