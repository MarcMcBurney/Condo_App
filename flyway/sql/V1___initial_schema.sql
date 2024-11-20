CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name varchar(255) NOT NULL,
  address varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  chorecoins integer NOT NULL DEFAULT 0,
  password varchar(60) NOT NULL
);

CREATE UNIQUE INDEX ON users((lower(email)));

CREATE TABLE chores (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL,
  title varchar(255) NOT NULL,
  description TEXT NOT NULL,
  chorecoins integer NOT NULL DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE chore_assignments (
  user_id integer NOT NULL,
  chore_id integer NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_chore_id FOREIGN KEY (chore_id) REFERENCES chores(id)
);
