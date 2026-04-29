CREATE DATABASE IF NOT EXISTS pomodoro_pond;
USE pomodoro_pond;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_boards_user (user_id),
  CONSTRAINT fk_boards_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  board_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  planned_minutes INT UNSIGNED NOT NULL,
  outcome ENUM('pending', 'done', 'justified', 'not-justified', 'paused') NOT NULL DEFAULT 'pending',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_board (board_id),
  KEY idx_tasks_board_position (board_id, position),
  CONSTRAINT fk_tasks_board FOREIGN KEY (board_id)
    REFERENCES boards(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  board_id VARCHAR(64) NOT NULL,
  date_key DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  planned_minutes INT UNSIGNED NOT NULL,
  worked_seconds INT UNSIGNED NOT NULL,
  outcome ENUM('started', 'done', 'justified', 'not-justified', 'paused') NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_history_board_date (board_id, date_key),
  KEY idx_history_board_created (board_id, created_at),
  CONSTRAINT fk_history_board FOREIGN KEY (board_id)
    REFERENCES boards(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, username, password_hash)
VALUES (1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  password_hash = VALUES(password_hash);
