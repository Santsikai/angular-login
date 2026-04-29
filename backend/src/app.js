require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const boardsRoutes = require('./routes/boards.routes');
const tasksRoutes = require('./routes/tasks.routes');
const historyRoutes = require('./routes/history.routes');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'backend', database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, service: 'backend', database: 'error', message: error.message });
  }
});

app.use('/api/boards', boardsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/history', historyRoutes);

app.use((error, _req, res, _next) => {
  const code = error.status || 500;
  res.status(code).json({
    message: error.message || 'Error interno del servidor'
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
