const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = Number(req.query.userId || 1);
    const [rows] = await pool.query(
      `SELECT id, name, created_at AS createdAt, pomodoro_state AS pomodoroState
       FROM boards
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = Number(req.body.userId || 1);
    const rawName = String(req.body.name || '').trim();
    const name = rawName.slice(0, 120) || 'Nuevo board';
    const id = req.body.id
      ? String(req.body.id)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
      `INSERT INTO boards (id, user_id, name)
       VALUES (?, ?, ?)`,
      [id, userId, name]
    );

    const [[created]] = await pool.query(
      `SELECT id, name, created_at AS createdAt
       FROM boards
       WHERE id = ?`,
      [id]
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put('/:boardId', async (req, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const rawName = String(req.body.name || '').trim();
    const name = rawName.slice(0, 120) || 'Nuevo board';

    const [result] = await pool.query(
      `UPDATE boards
       SET name = ?
       WHERE id = ?`,
      [name, boardId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Board no encontrado' });
      return;
    }

    const [[updated]] = await pool.query(
      `SELECT id, name, created_at AS createdAt
       FROM boards
       WHERE id = ?`,
      [boardId]
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch('/:boardId/state', async (req, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const state = req.body.state !== undefined ? req.body.state : null;
    const stateJson = state !== null ? JSON.stringify(state) : null;

    const [result] = await pool.query(
      `UPDATE boards SET pomodoro_state = ? WHERE id = ?`,
      [stateJson, boardId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Board no encontrado' });
      return;
    }

    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:boardId', async (req, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const [result] = await pool.query('DELETE FROM boards WHERE id = ?', [boardId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Board no encontrado' });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
