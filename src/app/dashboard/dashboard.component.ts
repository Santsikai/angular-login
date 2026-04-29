import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { TaskHistoryOutcome, TaskHistoryService } from '../task-history.service';
import { BoardService, DASHBOARD_STATE_KEY_PREFIX, PomodoroBoard } from '../board.service';

type PomodoroMode = 'focus' | 'short' | 'long';

interface TaskItem {
  title: string;
  minutes: number;
  outcome: 'pending' | 'done' | 'justified' | 'not-justified' | 'paused';
}

const CIRCUMFERENCE = 2 * Math.PI * 96; // r=96
interface DashboardPersistedState {
  mode: PomodoroMode;
  secondsLeft: number;
  completedPomodoros: number;
  round: number;
  durations: Record<PomodoroMode, number>;
  draftMinutes: Record<PomodoroMode, number>;
  tasks: TaskItem[];
  draftTaskTitle: string;
  draftTaskHours: number;
  draftTaskMinutes: number;
  focusSecondsWorked: number;
  resumeOnLoad: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  boards: PomodoroBoard[] = [];
  selectedBoardId = '';

  mode: PomodoroMode = 'focus';
  running = false;
  secondsLeft = 25 * 60;
  completedPomodoros = 0;
  round = 1;
  pomodoroSlots = [0, 1, 2, 3];
  showSettings = false;
  showTasks = false;

  durations: Record<PomodoroMode, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  draftMinutes: Record<PomodoroMode, number> = { focus: 25, short: 5, long: 15 };
  tasks: TaskItem[] = [];
  draftTaskTitle = '';
  draftTaskHours = 0;
  draftTaskMinutes = 25;
  focusSecondsWorked = 0;
  taskDecisionOpen = false;
  taskDecisionIndex = -1;
  taskDecisionNeedsJustification = false;
  taskDecisionManual = false;
  taskDecisionWorkedSeconds = 0;
  taskDecisionPlannedMinutes = 0;
  celebrationOpen = false;
  celebrationTaskTitle = '';

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sessionTaskIndex = -1;
  private sessionTaskTitle = '';
  private sessionTaskPlannedMinutes = 0;
  private sessionFocusWorkedStart = 0;

  constructor(
    private authService: AuthService,
    private router: Router,
    private taskHistoryService: TaskHistoryService,
    private boardService: BoardService
  ) {}

  ngOnInit(): void {
    this.loadBoards();
  }

  get selectedBoardName(): string {
    const board = this.boards.find(item => item.id === this.selectedBoardId);
    return board ? board.name : 'Board';
  }

  get timeDisplay(): string {
    const m = Math.floor(this.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.secondsLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  get modeLabel(): string {
    return { focus: 'Enfoque', short: 'Descanso corto', long: 'Descanso largo' }[this.mode];
  }

  get dashOffset(): number {
    const progress = this.secondsLeft / this.durations[this.mode];
    return CIRCUMFERENCE * (1 - progress);
  }

  get totalTaskSeconds(): number {
    return this.tasks.reduce((acc, task) => acc + task.minutes * 60, 0);
  }

  get totalProgressPercent(): number {
    if (this.totalTaskSeconds === 0) {
      return 0;
    }
    return Math.min(100, (this.focusSecondsWorked / this.totalTaskSeconds) * 100);
  }

  get currentTaskIndex(): number {
    if (this.tasks.length === 0 || this.totalTaskSeconds === 0 || !this.tasks.some(task => task.outcome === 'pending')) {
      return -1;
    }

    let elapsed = this.focusSecondsWorked;
    for (let i = 0; i < this.tasks.length; i++) {
      const taskSeconds = this.tasks[i].minutes * 60;
      if (elapsed < taskSeconds) {
        if (this.tasks[i].outcome === 'pending') {
          return i;
        }
        return this.findNextPendingTaskIndex(i + 1);
      }
      elapsed -= taskSeconds;
    }
    return this.findNextPendingTaskIndex(0);
  }

  get currentTaskTitle(): string {
    const idx = this.currentTaskIndex;
    if (idx < 0) {
      return 'Sin tareas';
    }
    if (this.totalProgressPercent >= 100) {
      return 'Todas completadas';
    }
    return this.tasks[idx].title;
  }

  get currentTaskProgressPercent(): number {
    const idx = this.currentTaskIndex;
    if (idx < 0 || this.totalProgressPercent >= 100) {
      return 0;
    }

    let elapsed = this.focusSecondsWorked;
    for (let i = 0; i < idx; i++) {
      elapsed -= this.tasks[i].minutes * 60;
    }
    const taskSeconds = this.tasks[idx].minutes * 60;
    if (taskSeconds <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (elapsed / taskSeconds) * 100));
  }

  get currentTaskProgressLabel(): string {
    const idx = this.currentTaskIndex;
    if (idx < 0) {
      return '0 / 0 min';
    }

    let elapsed = this.focusSecondsWorked;
    for (let i = 0; i < idx; i++) {
      elapsed -= this.tasks[i].minutes * 60;
    }
    elapsed = Math.max(0, elapsed);
    const totalMins = this.tasks[idx].minutes;
    const elapsedMins = Math.min(totalMins, Math.floor(elapsed / 60));
    return `${elapsedMins} / ${totalMins} min`;
  }

  get totalProgressLabel(): string {
    if (this.totalTaskSeconds === 0) {
      return '0 / 0 min';
    }
    const worked = Math.min(this.totalTaskSeconds, this.focusSecondsWorked);
    return `${Math.floor(worked / 60)} / ${Math.floor(this.totalTaskSeconds / 60)} min`;
  }

  get taskDecisionTitle(): string {
    if (this.taskDecisionIndex < 0 || this.taskDecisionIndex >= this.tasks.length) {
      return 'Tarea';
    }
    return this.tasks[this.taskDecisionIndex].title;
  }

  get canRunPomodoro(): boolean {
    return this.tasks.some(task => task.outcome === 'pending') && this.totalTaskSeconds > 0 && this.totalProgressPercent < 100;
  }

  get allTasksCompleted(): boolean {
    return this.tasks.length > 0 && this.totalProgressPercent >= 100;
  }

  taskDurationLabel(task: TaskItem): string {
    const hours = Math.floor(task.minutes / 60);
    const mins = task.minutes % 60;
    if (hours > 0) {
      if (mins > 0) {
        return `${hours} h ${mins} min`;
      }
      return `${hours} h`;
    }
    return `${mins} min`;
  }

  addTask(): void {
    const title = this.draftTaskTitle.trim();
    const hours = Math.max(0, Math.min(12, Math.floor(this.draftTaskHours || 0)));
    const mins = Math.max(0, Math.min(59, Math.floor(this.draftTaskMinutes || 0)));
    const minutes = Math.max(1, Math.min(12 * 60, (hours * 60) + mins));
    if (!title) {
      return;
    }
    this.tasks.push({ title, minutes, outcome: 'pending' });
    this.draftTaskTitle = '';
    this.draftTaskHours = 0;
    this.draftTaskMinutes = 25;
  }

  clampDraftTaskDuration(): void {
    this.draftTaskHours = Math.max(0, Math.min(12, Math.floor(this.draftTaskHours || 0)));
    this.draftTaskMinutes = Math.max(0, Math.min(59, Math.floor(this.draftTaskMinutes || 0)));
    if (this.draftTaskHours === 0 && this.draftTaskMinutes === 0) {
      this.draftTaskMinutes = 1;
    }
  }

  removeTask(index: number): void {
    this.tasks.splice(index, 1);
    if (this.totalTaskSeconds === 0) {
      this.stop();
      this.focusSecondsWorked = 0;
      return;
    }
    this.focusSecondsWorked = Math.min(this.focusSecondsWorked, this.totalTaskSeconds);
  }

  canSelectTask(index: number): boolean {
    if (index < 0 || index >= this.tasks.length) {
      return false;
    }
    const task = this.tasks[index];
    const selectable = task.outcome === 'pending' || task.outcome === 'paused';
    return selectable && this.currentTaskIndex !== index;
  }

  selectTaskNow(index: number): void {
    if (index < 0 || index >= this.tasks.length) {
      return;
    }
    if (!this.canSelectTask(index)) {
      return;
    }

    const targetIndex = this.currentTaskIndex >= 0
      ? this.currentTaskIndex
      : this.tasks.findIndex(task => task.outcome === 'pending');

    if (targetIndex < 0 || targetIndex === index) {
      return;
    }

    const [selected] = this.tasks.splice(index, 1);
    selected.outcome = 'pending';
    const insertAt = targetIndex > index ? targetIndex - 1 : targetIndex;
    this.tasks.splice(insertAt, 0, selected);
    this.focusSecondsWorked = this.getTaskStartSeconds(insertAt);
  }

  finishCurrentTaskEarly(): void {
    const idx = this.currentTaskIndex;
    if (idx < 0 || this.totalProgressPercent >= 100 || this.mode !== 'focus') {
      return;
    }
    this.stop(false);
    this.openTaskDecision(idx, true);
  }

  pauseCurrentTaskEarly(): void {
    const idx = this.currentTaskIndex;
    if (idx < 0 || this.totalProgressPercent >= 100 || this.mode !== 'focus') {
      return;
    }
    this.stop(false);
    this.openTaskDecision(idx, true);
    this.pauseCurrentTask();
  }

  respondTaskFinished(finished: boolean): void {
    if (!this.taskDecisionOpen || this.taskDecisionIndex < 0) {
      return;
    }
    if (finished) {
      const completedTitle = this.tasks[this.taskDecisionIndex].title;
      this.tasks[this.taskDecisionIndex].outcome = 'done';
      this.saveTaskHistory('done');
      this.completeTaskAndCloseDecision();
      this.openCelebration(completedTitle);
      return;
    }
    this.taskDecisionNeedsJustification = true;
  }

  closeCelebrationModal(): void {
    this.celebrationOpen = false;
    this.celebrationTaskTitle = '';
  }

  respondTaskJustification(justified: boolean): void {
    if (!this.taskDecisionOpen || this.taskDecisionIndex < 0) {
      return;
    }
    const task = this.tasks[this.taskDecisionIndex];
    task.outcome = justified ? 'justified' : 'not-justified';
    this.saveTaskHistory(justified ? 'justified' : 'not-justified');
    const extraSeconds = Math.floor(task.minutes * 60 / 4);
    task.minutes = task.minutes + Math.floor(task.minutes / 4);
    this.focusSecondsWorked -= extraSeconds;
    this.completeTaskAndCloseDecision();
  }

  pauseCurrentTask(): void {
    if (!this.taskDecisionOpen || this.taskDecisionIndex < 0 || this.taskDecisionIndex >= this.tasks.length) {
      return;
    }

    const taskIndex = this.taskDecisionIndex;
    const task = this.tasks[this.taskDecisionIndex];
    const plannedSeconds = Math.max(60, Math.floor((this.taskDecisionPlannedMinutes || task.minutes) * 60));
    const workedSeconds = Math.max(0, Math.min(plannedSeconds, Math.floor(this.taskDecisionWorkedSeconds)));
    const remainingMinutes = Math.max(1, Math.ceil((plannedSeconds - workedSeconds) / 60));
    this.saveTaskHistory('paused');

    const taskStart = this.getTaskStartSeconds(taskIndex);
    task.outcome = 'paused';
    task.minutes = remainingMinutes;
    this.focusSecondsWorked = taskStart;

    const [pausedTask] = this.tasks.splice(taskIndex, 1);
    this.tasks.push(pausedTask);

    this.taskDecisionOpen = false;
    this.taskDecisionIndex = -1;
    this.taskDecisionNeedsJustification = false;
    this.taskDecisionManual = false;
    this.taskDecisionWorkedSeconds = 0;
    this.taskDecisionPlannedMinutes = 0;

    if (this.canRunPomodoro) {
      this.start();
    }
  }

  closeTaskDecisionModal(): void {
    if (!this.taskDecisionOpen || !this.taskDecisionManual) {
      return;
    }
    this.taskDecisionOpen = false;
    this.taskDecisionIndex = -1;
    this.taskDecisionNeedsJustification = false;
    this.taskDecisionManual = false;
    if (this.canRunPomodoro) {
      this.start();
    }
  }

  clampDraft(mode: PomodoroMode): void {
    const max = mode === 'focus' ? 90 : 60;
    this.draftMinutes[mode] = Math.max(1, Math.min(max, Math.floor(this.draftMinutes[mode] || 1)));
  }

  applySettings(): void {
    (['focus', 'short', 'long'] as PomodoroMode[]).forEach(m => {
      this.durations[m] = this.draftMinutes[m] * 60;
    });
    this.stop();
    this.secondsLeft = this.durations[this.mode];
    this.showSettings = false;
  }

  toggleTimer(): void {
    if (!this.running && !this.canRunPomodoro) {
      return;
    }
    this.running ? this.stop() : this.start();
  }

  reset(): void {
    this.stop();
    this.secondsLeft = this.durations[this.mode];
  }

  skip(): void {
    this.stop();
    this.advance();
  }

  restartPomodoro(): void {
    this.resetPomodoroAfterTasksCompleted();
  }

  logout(): void {
    this.clearSavedState();
    this.stop();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToHistory(): void {
    this.saveState(this.running);
    this.showTasks = false;
    this.router.navigate(['/history']);
  }

  onBoardChanged(boardId: string): void {
    if (!boardId || boardId === this.selectedBoardId) {
      return;
    }
    const wasRunning = this.running;
    this.stop();
    this.saveState(wasRunning);
    this.selectedBoardId = boardId;
    this.boardService.setActiveBoardId(boardId);
    this.resetBoardRuntime();
    this.restoreState();
  }

  createBoard(): void {
    const input = window.prompt('Nombre del nuevo board:');
    if (input === null) {
      return;
    }
    const name = input.trim();
    if (!name) {
      return;
    }
    this.boardService.createBoard(name).subscribe(board => {
      this.boards = [...this.boards, board];
      this.boardService.setActiveBoardId(board.id);
      this.onBoardChanged(board.id);
    });
  }

  deleteCurrentBoard(): void {
    if (this.boards.length <= 1) {
      window.alert('No puedes borrar el unico board.');
      return;
    }

    const name = this.selectedBoardName;
    const confirmed = window.confirm(`Borrar board \"${name}\"? Se eliminaran sus tareas e historial.`);
    if (!confirmed) {
      return;
    }

    const removedBoardId = this.selectedBoardId;
    this.stop();
    this.taskHistoryService.deleteEntriesForBoard(removedBoardId);
    this.removeSavedStateForBoard(removedBoardId);

    this.boardService.deleteBoard(removedBoardId).subscribe(() => {
      this.boards = this.boards.filter(b => b.id !== removedBoardId);
      const nextId = this.boards[0]?.id || '';
      this.selectedBoardId = nextId;
      this.boardService.setActiveBoardId(nextId);
      this.resetBoardRuntime();
      this.restoreState();
    });
  }

  ngOnDestroy(): void {
    this.saveState(this.running);
    this.stop();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.stop();
    this.mode = 'focus';
    this.secondsLeft = 25 * 60;
    this.saveState(false);
  }

  private start(): void {
    if (!this.canRunPomodoro) {
      this.stop();
      return;
    }
    this.openTaskSession();
    this.running = true;
    this.intervalId = setInterval(() => {
      if (this.secondsLeft > 0) {
        let reachedTaskIndex = -1;
        if (this.mode === 'focus' && this.totalTaskSeconds > 0) {
          const before = this.focusSecondsWorked;
          this.focusSecondsWorked = Math.min(this.totalTaskSeconds, this.focusSecondsWorked + 1);
          reachedTaskIndex = this.getReachedTaskBoundaryIndex(before, this.focusSecondsWorked);
        }
        this.secondsLeft--;

        if (reachedTaskIndex >= 0) {
          this.stop(false);
          this.openTaskDecision(reachedTaskIndex, false);
          return;
        }
      } else {
        this.stop();
        this.advance();
      }
    }, 1000);
  }

  private stop(saveSession = true): void {
    if (saveSession) {
      this.closeTaskSession();
    } else {
      this.clearTaskSession();
    }
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private advance(): void {
    if (!this.canRunPomodoro) {
      this.stop();
      return;
    }

    if (this.mode === 'focus') {
      this.completedPomodoros++;
      const isLongBreak = this.completedPomodoros % 4 === 0;
      if (isLongBreak) {
        this.round++;
        this.mode = 'long';
      } else {
        this.mode = 'short';
      }
    } else {
      this.mode = 'focus';
    }
    this.secondsLeft = this.durations[this.mode];
  }

  private getReachedTaskBoundaryIndex(before: number, after: number): number {
    let end = 0;
    for (let i = 0; i < this.tasks.length; i++) {
      end += this.tasks[i].minutes * 60;
      if (before < end && after >= end) {
        return i;
      }
    }
    return -1;
  }

  private getTaskEndSeconds(index: number): number {
    let end = 0;
    for (let i = 0; i <= index && i < this.tasks.length; i++) {
      end += this.tasks[i].minutes * 60;
    }
    return end;
  }

  private getTaskStartSeconds(index: number): number {
    let start = 0;
    for (let i = 0; i < index && i < this.tasks.length; i++) {
      start += this.tasks[i].minutes * 60;
    }
    return start;
  }

  private findNextPendingTaskIndex(startIndex: number): number {
    for (let i = startIndex; i < this.tasks.length; i++) {
      if (this.tasks[i].outcome === 'pending') {
        return i;
      }
    }
    return -1;
  }

  private openTaskDecision(index: number, manual: boolean): void {
    if (index < 0 || index >= this.tasks.length) {
      return;
    }
    const task = this.tasks[index];
    const taskStart = this.getTaskStartSeconds(index);
    const taskEnd = taskStart + task.minutes * 60;
    this.taskDecisionWorkedSeconds = Math.max(0, Math.min(task.minutes * 60, this.focusSecondsWorked - taskStart));
    if (!manual) {
      this.taskDecisionWorkedSeconds = Math.min(task.minutes * 60, Math.max(this.taskDecisionWorkedSeconds, taskEnd - taskStart));
    }
    this.taskDecisionPlannedMinutes = task.minutes;
    this.taskDecisionOpen = true;
    this.taskDecisionIndex = index;
    this.taskDecisionNeedsJustification = false;
    this.taskDecisionManual = manual;
    this.ringAlarm();
  }

  private completeTaskAndCloseDecision(): void {
    const end = this.getTaskEndSeconds(this.taskDecisionIndex);
    this.focusSecondsWorked = Math.max(this.focusSecondsWorked, end);
    this.taskDecisionOpen = false;
    this.taskDecisionIndex = -1;
    this.taskDecisionNeedsJustification = false;
    this.taskDecisionManual = false;
    this.taskDecisionWorkedSeconds = 0;
    this.taskDecisionPlannedMinutes = 0;

    if (this.allTasksCompleted) {
      this.resetPomodoroAfterTasksCompleted();
      return;
    }

    if (this.canRunPomodoro) {
      this.start();
    }
  }

  private saveTaskHistory(outcome: TaskHistoryOutcome): void {
    if (this.taskDecisionIndex < 0 || this.taskDecisionIndex >= this.tasks.length) {
      return;
    }
    const task = this.tasks[this.taskDecisionIndex];
    this.taskHistoryService.addEntry(this.selectedBoardId, {
      title: task.title,
      plannedMinutes: this.taskDecisionPlannedMinutes || task.minutes,
      workedSeconds: this.taskDecisionWorkedSeconds,
      outcome
    });
  }

  private openTaskSession(): void {
    if (this.mode !== 'focus') {
      this.clearTaskSession();
      return;
    }
    const index = this.currentTaskIndex;
    if (index < 0 || index >= this.tasks.length) {
      this.clearTaskSession();
      return;
    }

    const task = this.tasks[index];
    this.sessionTaskIndex = index;
    this.sessionTaskTitle = task.title;
    this.sessionTaskPlannedMinutes = task.minutes;
    this.sessionFocusWorkedStart = this.focusSecondsWorked;

    this.taskHistoryService.addEntry(this.selectedBoardId, {
      title: task.title,
      plannedMinutes: task.minutes,
      workedSeconds: 0,
      outcome: 'started'
    });
  }

  private closeTaskSession(): void {
    if (this.sessionTaskIndex < 0 || this.mode !== 'focus') {
      this.clearTaskSession();
      return;
    }

    const workedSeconds = Math.max(0, Math.floor(this.focusSecondsWorked - this.sessionFocusWorkedStart));
    if (workedSeconds > 0) {
      this.taskHistoryService.addEntry(this.selectedBoardId, {
        title: this.sessionTaskTitle,
        plannedMinutes: this.sessionTaskPlannedMinutes,
        workedSeconds,
        outcome: 'paused'
      });
    }
    this.clearTaskSession();
  }

  private clearTaskSession(): void {
    this.sessionTaskIndex = -1;
    this.sessionTaskTitle = '';
    this.sessionTaskPlannedMinutes = 0;
    this.sessionFocusWorkedStart = 0;
  }

  private ringAlarm(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.28);
    } catch {
      // Ignore if audio cannot be played in this browser context.
    }
  }

  private openCelebration(taskTitle: string): void {
    this.celebrationTaskTitle = taskTitle;
    this.celebrationOpen = true;
    this.playCelebrationSound();
  }

  private playCelebrationSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = audioContext.createGain();
      gain.gain.value = 0.035;
      gain.connect(audioContext.destination);

      const notes = [659.25, 783.99, 987.77];
      notes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(gain);
        const start = audioContext.currentTime + (index * 0.09);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch {
      // Ignore if audio cannot be played in this browser context.
    }
  }

  private saveState(resumeOnLoad: boolean): void {
    try {
      const state: DashboardPersistedState = {
        mode: this.mode,
        secondsLeft: this.secondsLeft,
        completedPomodoros: this.completedPomodoros,
        round: this.round,
        durations: this.durations,
        draftMinutes: this.draftMinutes,
        tasks: this.tasks,
        draftTaskTitle: this.draftTaskTitle,
        draftTaskHours: this.draftTaskHours,
        draftTaskMinutes: this.draftTaskMinutes,
        focusSecondsWorked: this.focusSecondsWorked,
        resumeOnLoad
      };
      localStorage.setItem(this.getStateStorageKey(), JSON.stringify(state));
    } catch {
      // Ignore persistence issues.
    }
  }

  private restoreState(): void {
    try {
      const raw = localStorage.getItem(this.getStateStorageKey());
      if (!raw) {
        return;
      }
      const state = JSON.parse(raw) as Partial<DashboardPersistedState>;
      if (!state || typeof state !== 'object') {
        return;
      }

      if (state.mode === 'focus' || state.mode === 'short' || state.mode === 'long') {
        this.mode = state.mode;
      }
      if (typeof state.secondsLeft === 'number' && state.secondsLeft >= 0) {
        this.secondsLeft = Math.floor(state.secondsLeft);
      }
      if (typeof state.completedPomodoros === 'number' && state.completedPomodoros >= 0) {
        this.completedPomodoros = Math.floor(state.completedPomodoros);
      }
      if (typeof state.round === 'number' && state.round >= 1) {
        this.round = Math.floor(state.round);
      }
      if (state.durations?.focus && state.durations?.short && state.durations?.long) {
        this.durations = {
          focus: Math.max(60, Math.floor(state.durations.focus)),
          short: Math.max(60, Math.floor(state.durations.short)),
          long: Math.max(60, Math.floor(state.durations.long))
        };
      }
      if (state.draftMinutes?.focus && state.draftMinutes?.short && state.draftMinutes?.long) {
        this.draftMinutes = {
          focus: Math.max(1, Math.floor(state.draftMinutes.focus)),
          short: Math.max(1, Math.floor(state.draftMinutes.short)),
          long: Math.max(1, Math.floor(state.draftMinutes.long))
        };
      }
      if (Array.isArray(state.tasks)) {
        this.tasks = state.tasks
          .filter(task => typeof task?.title === 'string' && typeof task?.minutes === 'number')
          .map(task => ({
            title: task.title,
            minutes: Math.max(1, Math.floor(task.minutes)),
            outcome: (task.outcome === 'done' || task.outcome === 'justified' || task.outcome === 'not-justified' || task.outcome === 'paused')
              ? task.outcome
              : 'pending'
          }));
      }
      if (typeof state.draftTaskTitle === 'string') {
        this.draftTaskTitle = state.draftTaskTitle;
      }
      if (typeof state.draftTaskHours === 'number' && state.draftTaskHours >= 0) {
        this.draftTaskHours = Math.max(0, Math.min(12, Math.floor(state.draftTaskHours)));
      }
      if (typeof state.draftTaskMinutes === 'number' && state.draftTaskMinutes >= 0) {
        this.draftTaskMinutes = Math.max(0, Math.min(59, Math.floor(state.draftTaskMinutes)));
      }
      if (typeof state.focusSecondsWorked === 'number' && state.focusSecondsWorked >= 0) {
        this.focusSecondsWorked = Math.floor(state.focusSecondsWorked);
      }

      const total = this.totalTaskSeconds;
      if (total > 0) {
        this.focusSecondsWorked = Math.min(this.focusSecondsWorked, total);
      }

      if (state.resumeOnLoad && this.secondsLeft > 0 && this.canRunPomodoro) {
        this.start();
      }
    } catch {
      // Ignore invalid saved state.
    }
  }

  private clearSavedState(): void {
    try {
      localStorage.removeItem(this.getStateStorageKey());
    } catch {
      // Ignore persistence issues.
    }
  }

  private loadBoards(): void {
    const savedActive = this.boardService.getActiveBoardId();
    this.boardService.getBoards().subscribe(boards => {
      if (boards.length === 0) {
        this.boardService.createBoard('Board principal').subscribe(board => {
          this.boards = [board];
          this.selectedBoardId = board.id;
          this.boardService.setActiveBoardId(board.id);
          this.restoreState();
        });
        return;
      }
      this.boards = boards;
      const active = boards.find(b => b.id === savedActive);
      this.selectedBoardId = active ? active.id : boards[0].id;
      this.boardService.setActiveBoardId(this.selectedBoardId);
      this.restoreState();
    });
  }

  private getStateStorageKey(): string {
    return `${DASHBOARD_STATE_KEY_PREFIX}:${this.selectedBoardId}`;
  }

  private removeSavedStateForBoard(boardId: string): void {
    try {
      localStorage.removeItem(`${DASHBOARD_STATE_KEY_PREFIX}:${boardId}`);
    } catch {
      // Ignore persistence issues.
    }
  }

  private resetBoardRuntime(): void {
    this.mode = 'focus';
    this.running = false;
    this.secondsLeft = 25 * 60;
    this.completedPomodoros = 0;
    this.round = 1;
    this.showSettings = false;
    this.showTasks = false;
    this.durations = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
    this.draftMinutes = { focus: 25, short: 5, long: 15 };
    this.tasks = [];
    this.draftTaskTitle = '';
    this.draftTaskHours = 0;
    this.draftTaskMinutes = 25;
    this.focusSecondsWorked = 0;
    this.taskDecisionOpen = false;
    this.taskDecisionIndex = -1;
    this.taskDecisionNeedsJustification = false;
    this.taskDecisionManual = false;
    this.taskDecisionWorkedSeconds = 0;
    this.taskDecisionPlannedMinutes = 0;
    this.clearTaskSession();
  }

  private resetPomodoroAfterTasksCompleted(): void {
    this.stop();
    this.mode = 'focus';
    this.secondsLeft = this.durations.focus;
    this.completedPomodoros = 0;
    this.round = 1;
  }
}
