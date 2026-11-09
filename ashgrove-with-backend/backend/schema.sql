CREATE DATABASE IF NOT EXISTS ashgrove CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ashgrove;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  username      VARCHAR(30)   NOT NULL,
  email         VARCHAR(190)  NOT NULL,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contacts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120)  NOT NULL,
  email        VARCHAR(190)  NOT NULL,
  phone        VARCHAR(40)   NULL,
  project_type VARCHAR(80)   NULL,
  budget       VARCHAR(80)   NULL,
  start_when   VARCHAR(80)   NULL,
  message      TEXT          NULL,
  replied_at   TIMESTAMP     NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contacts_email (email),
  KEY idx_contacts_created (created_at)
) ENGINE=InnoDB;

-- Create a database user that can only touch this database (replace the password):
-- CREATE USER 'ashgrove_app'@'localhost' IDENTIFIED BY 'change-this-password';
-- GRANT SELECT, INSERT, UPDATE ON ashgrove.* TO 'ashgrove_app'@'localhost';

-- If you created the users table before usernames existed, run this once:
-- ALTER TABLE users ADD COLUMN username VARCHAR(30) NULL AFTER name;
-- UPDATE users SET username = CONCAT('user', id) WHERE username IS NULL;
-- ALTER TABLE users MODIFY username VARCHAR(30) NOT NULL, ADD UNIQUE KEY uq_users_username (username);
