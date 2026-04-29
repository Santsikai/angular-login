import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

const API_BASE = 'http://localhost:3001/api';

@Injectable({ providedIn: 'root' })
export class TaskHistoryService {
  constructor(private http: HttpClient) {}

  getEntriesForBoard(boardId: string): Observable<TaskHistoryEntry[]> {
    return this.http.get<TaskHistoryEntry[]>(`${API_BASE}/history?boardId=${boardId}`);
  }

  addEntry(boardId: string, payload: CreateTaskHistoryEntry): void {
    const now = new Date();
    const entry = {
      boardId,
      date: this.toDateKey(now),
      title: payload.title.trim(),
      plannedMinutes: Math.max(1, Math.floor(payload.plannedMinutes)),
      workedSeconds: Math.max(0, Math.floor(payload.workedSeconds)),
      outcome: payload.outcome,
      createdAt: now.toISOString()
    };
    this.http.post(`${API_BASE}/history`, entry).subscribe();
  }

  deleteEntriesForBoard(boardId: string): void {
    this.http.delete(`${API_BASE}/history/board/${boardId}`).subscribe();
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
