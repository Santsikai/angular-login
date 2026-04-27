import { Injectable } from '@angular/core';

export const DEFAULT_BOARD_ID = 'board-default';
export const DASHBOARD_STATE_KEY_PREFIX = 'pomodoro-pond-dashboard-state-v1';

export interface PomodoroBoard {
  id: string;
  name: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly boardsKey = 'pomodoro-pond-boards-v1';
  private readonly activeBoardKey = 'pomodoro-pond-active-board-v1';

  getBoards(): PomodoroBoard[] {
    const boards = this.readBoards();
    if (boards.length === 0) {
      const fallback: PomodoroBoard = {
        id: DEFAULT_BOARD_ID,
        name: 'Board principal',
        createdAt: new Date().toISOString()
      };
      this.writeBoards([fallback]);
      this.setActiveBoardId(fallback.id);
      return [fallback];
    }
    return boards;
  }

  getActiveBoardId(): string {
    const active = localStorage.getItem(this.activeBoardKey);
    const boards = this.getBoards();
    if (active && boards.some(board => board.id === active)) {
      return active;
    }
    const first = boards[0].id;
    this.setActiveBoardId(first);
    return first;
  }

  setActiveBoardId(boardId: string): void {
    localStorage.setItem(this.activeBoardKey, boardId);
  }

  createBoard(name: string): PomodoroBoard {
    const cleanName = name.trim().slice(0, 40) || 'Nuevo board';
    const board: PomodoroBoard = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      createdAt: new Date().toISOString()
    };

    const boards = this.getBoards();
    boards.push(board);
    this.writeBoards(boards);
    this.setActiveBoardId(board.id);
    return board;
  }

  getBoardName(boardId: string): string {
    const board = this.getBoards().find(item => item.id === boardId);
    return board ? board.name : 'Board';
  }

  deleteBoard(boardId: string): { deleted: boolean; nextActiveBoardId: string } {
    const boards = this.getBoards();
    if (boards.length <= 1) {
      return { deleted: false, nextActiveBoardId: this.getActiveBoardId() };
    }

    const exists = boards.some(board => board.id === boardId);
    if (!exists) {
      return { deleted: false, nextActiveBoardId: this.getActiveBoardId() };
    }

    const remaining = boards.filter(board => board.id !== boardId);
    this.writeBoards(remaining);

    const currentActive = this.getActiveBoardId();
    const nextActiveBoardId = currentActive === boardId
      ? remaining[0].id
      : currentActive;

    this.setActiveBoardId(nextActiveBoardId);
    return { deleted: true, nextActiveBoardId };
  }

  private readBoards(): PomodoroBoard[] {
    try {
      const raw = localStorage.getItem(this.boardsKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as PomodoroBoard[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(board =>
        typeof board?.id === 'string' &&
        typeof board?.name === 'string' &&
        typeof board?.createdAt === 'string'
      );
    } catch {
      return [];
    }
  }

  private writeBoards(boards: PomodoroBoard[]): void {
    localStorage.setItem(this.boardsKey, JSON.stringify(boards));
  }
}
