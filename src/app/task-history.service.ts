import { Injectable } from '@angular/core';
import { DEFAULT_BOARD_ID } from './board.service';

export type TaskHistoryOutcome = 'started' | 'done' | 'justified' | 'not-justified' | 'paused';

export interface TaskHistoryEntry {
  id: string;
  boardId: string;
  date: string;
  title: string;
  plannedMinutes: number;
  workedSeconds: number;
  outcome: TaskHistoryOutcome;
  createdAt: string;
}

interface CreateTaskHistoryEntry {
  title: string;
  plannedMinutes: number;
  workedSeconds: number;
  outcome: TaskHistoryOutcome;
}

@Injectable({ providedIn: 'root' })
export class TaskHistoryService {
  private readonly storageKey = 'pomodoro-pond-task-history-v1';

  getEntries(): TaskHistoryEntry[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as TaskHistoryEntry[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(entry =>
        typeof entry?.date === 'string' &&
        typeof entry?.title === 'string' &&
        typeof entry?.plannedMinutes === 'number' &&
        typeof entry?.workedSeconds === 'number' &&
        typeof entry?.outcome === 'string'
      );
    } catch {
      return [];
    }
  }

  getEntriesForBoard(boardId: string): TaskHistoryEntry[] {
    return this.getEntries().filter(entry => {
      if (typeof entry.boardId === 'string' && entry.boardId.length > 0) {
        return entry.boardId === boardId;
      }
      return boardId === DEFAULT_BOARD_ID;
    });
  }

  addEntry(boardId: string, payload: CreateTaskHistoryEntry): void {
    const entries = this.getEntries();
    const now = new Date();
    const workedSeconds = Math.max(0, Math.floor(payload.workedSeconds));
    const entry: TaskHistoryEntry = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      boardId,
      date: this.toDateKey(now),
      title: payload.title.trim(),
      plannedMinutes: Math.max(1, Math.floor(payload.plannedMinutes)),
      workedSeconds,
      outcome: payload.outcome,
      createdAt: now.toISOString()
    };

    entries.push(entry);
    localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }

  deleteEntriesForBoard(boardId: string): void {
    const remaining = this.getEntries().filter(entry => {
      if (typeof entry.boardId === 'string' && entry.boardId.length > 0) {
        return entry.boardId !== boardId;
      }
      return boardId !== DEFAULT_BOARD_ID;
    });
    localStorage.setItem(this.storageKey, JSON.stringify(remaining));
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
