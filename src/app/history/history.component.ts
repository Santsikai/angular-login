import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TaskHistoryEntry, TaskHistoryService } from '../task-history.service';
import { BoardService, DASHBOARD_STATE_KEY_PREFIX, PomodoroBoard } from '../board.service';

interface DayCard {
  key: string;
  date: Date;
  label: string;
  isToday: boolean;
  entries: TaskHistoryEntry[];
  totalSeconds: number;
}

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  boards: PomodoroBoard[] = [];
  selectedBoardId = '';
  mobileMenuOpen = false;
  showCreateBoardModal = false;
  draftBoardName = '';
  showEditBoardModal = false;
  draftEditBoardName = '';
  allEntries: TaskHistoryEntry[] = [];
  weekStart = this.getWeekStart(new Date());
  weekDays: DayCard[] = [];
  selectedDateKey = '';
  calendarDate = '';

  constructor(
    private historyService: TaskHistoryService,
    private router: Router,
    private boardService: BoardService
  ) {}

  ngOnInit(): void {
    this.loadBoards();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth > 620 && this.mobileMenuOpen) {
      this.mobileMenuOpen = false;
    }
  }

  get selectedBoardName(): string {
    const board = this.boards.find(item => item.id === this.selectedBoardId);
    return board ? board.name : 'Board';
  }

  get selectedDay(): DayCard | null {
    return this.weekDays.find(day => day.key === this.selectedDateKey) || null;
  }

  get weeklyTotalSeconds(): number {
    return this.weekDays.reduce((acc, day) => acc + day.totalSeconds, 0);
  }

  get weeklyTaskCount(): number {
    return this.weekDays.reduce((acc, day) => acc + day.entries.length, 0);
  }

  get weekRangeLabel(): string {
    const weekEnd = new Date(this.weekStart);
    weekEnd.setDate(this.weekStart.getDate() + 6);
    const start = this.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const end = weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    return `${start} - ${end}`;
  }

  goBackToPomodoro(): void {
    this.closeMobileMenu();
    this.router.navigate(['/dashboard']);
  }

  onBoardChanged(boardId: string): void {
    if (!boardId || boardId === this.selectedBoardId) {
      return;
    }
    this.selectedBoardId = boardId;
    this.closeMobileMenu();
    this.boardService.setActiveBoardId(boardId);
    this.loadHistory();
  }

  createBoard(): void {
    this.closeMobileMenu();
    this.draftBoardName = '';
    this.showCreateBoardModal = true;
  }

  closeCreateBoardModal(): void {
    this.showCreateBoardModal = false;
    this.draftBoardName = '';
  }

  confirmCreateBoard(): void {
    const name = this.draftBoardName.trim();
    if (!name) {
      return;
    }
    this.boardService.createBoard(name).subscribe(board => {
      this.closeCreateBoardModal();
      this.boards = [...this.boards, board];
      this.selectedBoardId = board.id;
      this.boardService.setActiveBoardId(board.id);
      this.loadHistory();
    });
  }

  beginEditBoard(): void {
    if (!this.selectedBoardId) {
      return;
    }
    this.closeMobileMenu();
    this.draftEditBoardName = this.selectedBoardName;
    this.showEditBoardModal = true;
  }

  closeEditBoardModal(): void {
    this.showEditBoardModal = false;
    this.draftEditBoardName = '';
  }

  confirmEditBoard(): void {
    const boardId = this.selectedBoardId;
    const name = this.draftEditBoardName.trim();
    if (!boardId || !name) {
      return;
    }

    this.boardService.updateBoard(boardId, name).subscribe(updated => {
      this.boards = this.boards.map(board => board.id === updated.id ? updated : board);
      this.closeEditBoardModal();
    });
  }

  deleteCurrentBoard(): void {
    if (this.boards.length <= 1) {
      window.alert('No puedes borrar el unico board.');
      return;
    }
    this.closeMobileMenu();

    const name = this.selectedBoardName;
    const confirmed = window.confirm(`Borrar board \"${name}\"? Se eliminaran sus tareas e historial.`);
    if (!confirmed) {
      return;
    }

    const removedBoardId = this.selectedBoardId;
    this.historyService.deleteEntriesForBoard(removedBoardId);
    this.removeSavedStateForBoard(removedBoardId);

    this.boardService.deleteBoard(removedBoardId).subscribe(() => {
      this.boards = this.boards.filter(b => b.id !== removedBoardId);
      const nextId = this.boards[0]?.id || '';
      this.selectedBoardId = nextId;
      this.boardService.setActiveBoardId(nextId);
      this.loadHistory();
    });
  }

  previousWeek(): void {
    const prev = new Date(this.weekStart);
    prev.setDate(prev.getDate() - 7);
    this.weekStart = this.getWeekStart(prev);
    this.buildWeekDays();
  }

  nextWeek(): void {
    const next = new Date(this.weekStart);
    next.setDate(next.getDate() + 7);
    this.weekStart = this.getWeekStart(next);
    this.buildWeekDays();
  }

  goToCurrentWeek(): void {
    this.weekStart = this.getWeekStart(new Date());
    this.buildWeekDays();
  }

  selectDay(dateKey: string): void {
    this.selectedDateKey = dateKey;
    this.calendarDate = dateKey;
  }

  onCalendarDateChange(dateKey: string): void {
    if (!dateKey) {
      return;
    }
    const parsed = this.fromDateKey(dateKey);
    if (!parsed) {
      return;
    }
    this.weekStart = this.getWeekStart(parsed);
    this.selectedDateKey = dateKey;
    this.buildWeekDays();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return `${hours} h ${remMins.toString().padStart(2, '0')} min`;
    }
    return `${remMins} min`;
  }

  labelOutcome(outcome: TaskHistoryEntry['outcome']): string {
    if (outcome === 'started') {
      return 'Iniciada';
    }
    if (outcome === 'done') {
      return 'Terminada';
    }
    if (outcome === 'paused') {
      return 'Pausada';
    }
    if (outcome === 'justified') {
      return 'No terminada (justificada)';
    }
    return 'No terminada';
  }

  private loadHistory(): void {
    if (!this.selectedBoardId) {
      return;
    }
    this.historyService.getEntriesForBoard(this.selectedBoardId).subscribe(entries => {
      this.allEntries = entries;
      this.buildWeekDays();
    });
  }

  private loadBoards(): void {
    const savedActive = this.boardService.getActiveBoardId();
    this.boardService.getBoards().subscribe(boards => {
      if (boards.length === 0) {
        this.boardService.createBoard('Board principal').subscribe(board => {
          this.boards = [board];
          this.selectedBoardId = board.id;
          this.boardService.setActiveBoardId(board.id);
          this.loadHistory();
        });
        return;
      }
      this.boards = boards;
      const active = boards.find(b => b.id === savedActive);
      this.selectedBoardId = active ? active.id : boards[0].id;
      this.boardService.setActiveBoardId(this.selectedBoardId);
      this.loadHistory();
    });
  }

  private buildWeekDays(): void {
    const todayKey = this.toDateKey(new Date());
    const days: DayCard[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(this.weekStart);
      date.setDate(this.weekStart.getDate() + i);
      const key = this.toDateKey(date);
      const dayEntries = this.allEntries
        .filter(entry => entry.date === key)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const entries = this.groupEntriesWithinDay(dayEntries);

      const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' });
      const totalSeconds = entries.reduce((acc, entry) => acc + entry.workedSeconds, 0);

      days.push({
        key,
        date,
        label,
        isToday: key === todayKey,
        entries,
        totalSeconds
      });
    }

    this.weekDays = days;

    const selectedExists = this.weekDays.some(day => day.key === this.selectedDateKey);
    if (!selectedExists) {
      const todayInWeek = this.weekDays.find(day => day.isToday);
      this.selectedDateKey = todayInWeek ? todayInWeek.key : this.weekDays[0]?.key || '';
    }
    this.calendarDate = this.selectedDateKey;
  }

  private groupEntriesWithinDay(entries: TaskHistoryEntry[]): TaskHistoryEntry[] {
    const pendingStarts: TaskHistoryEntry[] = [];
    const normalized: TaskHistoryEntry[] = [];

    for (const entry of entries) {
      if (entry.outcome === 'started') {
        pendingStarts.push(entry);
        continue;
      }

      if (entry.outcome === 'paused') {
        const startIndex = pendingStarts.findIndex(start => start.title === entry.title);
        if (startIndex >= 0) {
          const started = pendingStarts.splice(startIndex, 1)[0];
          normalized.push({
            ...entry,
            id: `${started.id}-${entry.id}`,
            title: started.title,
            plannedMinutes: started.plannedMinutes,
            workedSeconds: entry.workedSeconds,
            createdAt: started.createdAt
          });
          continue;
        }
      }

      normalized.push(entry);
    }

    normalized.push(...pendingStarts);
    normalized.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const byTask = new Map<string, TaskHistoryEntry>();
    for (const entry of normalized) {
      const key = entry.title.trim().toLowerCase();
      const existing = byTask.get(key);
      if (!existing) {
        byTask.set(key, { ...entry });
        continue;
      }

      existing.workedSeconds += entry.workedSeconds;
      existing.plannedMinutes = Math.max(existing.plannedMinutes, entry.plannedMinutes);
      existing.outcome = this.mergeOutcome(existing.outcome, entry.outcome);
      if (entry.createdAt > existing.createdAt) {
        existing.createdAt = entry.createdAt;
      }
    }

    return Array.from(byTask.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private mergeOutcome(
    current: TaskHistoryEntry['outcome'],
    incoming: TaskHistoryEntry['outcome']
  ): TaskHistoryEntry['outcome'] {
    if (incoming !== 'started') {
      return incoming;
    }
    return current;
  }

  private getWeekStart(base: Date): Date {
    const date = new Date(base);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fromDateKey(dateKey: string): Date | null {
    const [year, month, day] = dateKey.split('-').map(part => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private removeSavedStateForBoard(boardId: string): void {
    try {
      localStorage.removeItem(`${DASHBOARD_STATE_KEY_PREFIX}:${boardId}`);
    } catch {
      // Ignore persistence issues.
    }
  }
}
