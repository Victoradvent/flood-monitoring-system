CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'viewer', -- 'admin', 'operator', 'viewer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

--  users (update passwords in production!)
INSERT INTO users (username, password_hash, role)
VALUES 
  ('admin', '$2b$10$hashedPasswordHere', 'admin'),
  ('operator', '$2b$10$anotherHashHere', 'operator');
