const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const boardId = String(req.query.boardId || '');
    if (!boardId) {
      res.status(400).json({ message: 'boardId es obligatorio' });
      return;
    }

    const [rows] = await pool.query(
      `SELECT id, board_id AS boardId, title, planned_minutes AS minutes, outcome, position,
              created_at AS createdAt, updated_at AS updatedAt
       FROM tasks
       WHERE board_id = ?
       ORDER BY position ASC, id ASC`,
      [boardId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const boardId = String(req.body.boardId || '');
    const title = String(req.body.title || '').trim();
    const minutes = Math.max(1, Math.floor(Number(req.body.minutes || 1)));
    const outcome = req.body.outcome || 'pending';

    if (!boardId || !title) {
      res.status(400).json({ message: 'boardId y title son obligatorios' });
      return;
    }

    const [[maxPosRow]] = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS maxPosition FROM tasks WHERE board_id = ?',
      [boardId]
    );

    const position = Number(maxPosRow.maxPosition) + 1;

    const [insertResult] = await pool.query(
      `INSERT INTO tasks (board_id, title, planned_minutes, outcome, position)
       VALUES (?, ?, ?, ?, ?)`,
      [boardId, title, minutes, outcome, position]
    );

    const [[created]] = await pool.query(
      `SELECT id, board_id AS boardId, title, planned_minutes AS minutes, outcome, position,
              created_at AS createdAt, updated_at AS updatedAt
       FROM tasks
       WHERE id = ?`,
      [insertResult.insertId]
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch('/:taskId', async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!taskId) {
      res.status(400).json({ message: 'taskId invalido' });
      return;
    }

    const fields = [];
    const values = [];

    if (typeof req.body.title === 'string') {
      fields.push('title = ?');
      values.push(req.body.title.trim());
    }
    if (typeof req.body.minutes !== 'undefined') {
      fields.push('planned_minutes = ?');
      values.push(Math.max(1, Math.floor(Number(req.body.minutes || 1))));
    }
    if (typeof req.body.outcome === 'string') {
      fields.push('outcome = ?');
      values.push(req.body.outcome);
    }
    if (typeof req.body.position !== 'undefined') {
      fields.push('position = ?');
      values.push(Math.max(0, Math.floor(Number(req.body.position || 0))));
    }

    if (fields.length === 0) {
      res.status(400).json({ message: 'No hay campos para actualizar' });
      return;
    }

    values.push(taskId);

    const [result] = await pool.query(
      `UPDATE tasks
       SET ${fields.join(', ')}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    const [[updated]] = await pool.query(
      `SELECT id, board_id AS boardId, title, planned_minutes AS minutes, outcome, position,
              created_at AS createdAt, updated_at AS updatedAt
       FROM tasks
       WHERE id = ?`,
      [taskId]
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/bulk/:boardId', async (req, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const tasksRaw = Array.isArray(req.body.tasks) ? req.body.tasks : [];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM tasks WHERE board_id = ?', [boardId]);
      for (let i = 0; i < tasksRaw.length; i++) {
        const t = tasksRaw[i];
        const title = String(t.title || '').trim().slice(0, 255);
        const minutes = Math.max(1, Math.floor(Number(t.minutes || 1)));
        const validOutcomes = ['pending', 'done', 'justified', 'not-justified', 'paused'];
        const outcome = validOutcomes.includes(t.outcome) ? t.outcome : 'pending';
        if (!title) { continue; }
        await conn.query(
          `INSERT INTO tasks (board_id, title, planned_minutes, outcome, position) VALUES (?, ?, ?, ?, ?)`,
          [boardId, title, minutes, outcome, i]
        );
      }
      await conn.commit();
      res.json({ saved: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId', async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Tarea no encontrada' });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
