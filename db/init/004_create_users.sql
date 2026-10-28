CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'viewer', -- 'admin', 'operator', 'viewer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
