import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const DEFAULT_BOARD_ID = 'board-default';
export const DASHBOARD_STATE_KEY_PREFIX = 'pomodoro-pond-dashboard-state-v1';

export interface PomodoroBoard {
  id: string;
  name: string;
  createdAt: string;
  pomodoroState?: any;
}

const API_BASE = globalThis.location?.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';
const USER_ID = 1;
const ACTIVE_BOARD_KEY = 'pomodoro-pond-active-board-v1';

@Injectable({ providedIn: 'root' })
export class BoardService {
  constructor(private http: HttpClient) {}

  getBoards(): Observable<PomodoroBoard[]> {
    return this.http.get<PomodoroBoard[]>(`${API_BASE}/boards?userId=${USER_ID}`);
  }

  getActiveBoardId(): string {
    return localStorage.getItem(ACTIVE_BOARD_KEY) || '';
  }

  setActiveBoardId(boardId: string): void {
    localStorage.setItem(ACTIVE_BOARD_KEY, boardId);
  }

  createBoard(name: string): Observable<PomodoroBoard> {
    const cleanName = name.trim().slice(0, 40) || 'Nuevo board';
    return this.http.post<PomodoroBoard>(`${API_BASE}/boards`, { userId: USER_ID, name: cleanName });
  }

  updateBoard(boardId: string, name: string): Observable<PomodoroBoard> {
    const cleanName = name.trim().slice(0, 40) || 'Nuevo board';
    return this.http.put<PomodoroBoard>(`${API_BASE}/boards/${boardId}`, { name: cleanName });
  }

  deleteBoard(boardId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${API_BASE}/boards/${boardId}`);
  }

  savePomodoroState(boardId: string, state: any): Observable<{ saved: boolean }> {
    return this.http.patch<{ saved: boolean }>(`${API_BASE}/boards/${boardId}/state`, { state });
  }

  getTasksForBoard(boardId: string): Observable<{ title: string; minutes: number; outcome: string }[]> {
    return this.http.get<{ title: string; minutes: number; outcome: string }[]>(
      `${API_BASE}/tasks?boardId=${encodeURIComponent(boardId)}`
    );
  }

  saveTasksBulk(boardId: string, tasks: { title: string; minutes: number; outcome: string }[]): Observable<{ saved: boolean }> {
    return this.http.put<{ saved: boolean }>(`${API_BASE}/tasks/bulk/${boardId}`, { tasks });
  }
}
