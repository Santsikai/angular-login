const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      res.status(400).json({ message: 'Usuario y contraseña son obligatorios.' });
      return;
    }

    const [[user]] = await pool.query(
      `SELECT id, username
       FROM users
       WHERE username = ? AND password_hash = SHA2(?, 256)`,
      [username, password]
    );

    if (!user) {
      res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
      return;
    }

    res.json({ userId: Number(user.id), username: user.username });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
