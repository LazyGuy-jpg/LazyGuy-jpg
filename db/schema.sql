CREATE TABLE parent (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE child (
    id TEXT PRIMARY KEY,
    fcm_token TEXT,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES parent (id)
);

CREATE TABLE session (
    id TEXT PRIMARY KEY,
    parent_id INTEGER,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES parent (id)
);

CREATE TABLE gps (
    id INTEGER PRIMARY KEY,
    child_id TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES child (id)
);

CREATE TABLE sms (
    id INTEGER PRIMARY KEY,
    child_id TEXT,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    body TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES child (id)
);

CREATE TABLE calllog (
    id INTEGER PRIMARY KEY,
    child_id TEXT,
    number TEXT NOT NULL,
    type TEXT NOT NULL, -- incoming, outgoing, missed
    duration INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES child (id)
);

CREATE TABLE keystroke (
    id INTEGER PRIMARY KEY,
    child_id TEXT,
    keys TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES child (id)
);
