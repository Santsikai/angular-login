USE pomodoro_pond;

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS pomodoro_state JSON NULL;
