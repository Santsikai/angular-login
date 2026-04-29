const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const boardId = String(req.query.boardId || '');
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    if (!boardId) {
      res.status(400).json({ message: 'boardId es obligatorio' });
      return;
    }

    let query = `
      SELECT id, board_id AS boardId, DATE_FORMAT(date_key, '%Y-%m-%d') AS date,
             title, planned_minutes AS plannedMinutes, worked_seconds AS workedSeconds,
             outcome, created_at AS createdAt
      FROM task_history
      WHERE board_id = ?`;
    const params = [boardId];

    if (from) {
      query += ' AND date_key >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND date_key <= ?';
      params.push(to);
    }

    query += ' ORDER BY created_at ASC, id ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const boardId = String(req.body.boardId || '');
    const title = String(req.body.title || '').trim();
    const plannedMinutes = Math.max(1, Math.floor(Number(req.body.plannedMinutes || 1)));
    const workedSeconds = Math.max(0, Math.floor(Number(req.body.workedSeconds || 0)));
    const outcome = String(req.body.outcome || 'started');
    const dateValue = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
    const createdAt = req.body.createdAt ? new Date(req.body.createdAt) : new Date();

    if (!boardId || !title) {
      res.status(400).json({ message: 'boardId y title son obligatorios' });
      return;
    }

    const [insertResult] = await pool.query(
      `INSERT INTO task_history (
        board_id, date_key, title, planned_minutes, worked_seconds, outcome, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [boardId, dateValue, title, plannedMinutes, workedSeconds, outcome, createdAt]
    );

    const [[created]] = await pool.query(
      `SELECT id, board_id AS boardId, DATE_FORMAT(date_key, '%Y-%m-%d') AS date,
              title, planned_minutes AS plannedMinutes, worked_seconds AS workedSeconds,
              outcome, created_at AS createdAt
       FROM task_history
       WHERE id = ?`,
      [insertResult.insertId]
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.delete('/board/:boardId', async (req, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    await pool.query('DELETE FROM task_history WHERE board_id = ?', [boardId]);
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
