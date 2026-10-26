CREATE TABLE account_onboarding (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 date_of_birth TEXT NOT NULL,
 completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
