CREATE TABLE profiles (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL,
 bio TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator','admin')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE fandom_memberships (
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 fandom_id TEXT NOT NULL CHECK(fandom_id IN ('taylor','sabrina','olivia','screen')),
 PRIMARY KEY(user_id,fandom_id)
);
CREATE TABLE posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 fandom_id TEXT NOT NULL CHECK(fandom_id IN ('taylor','sabrina','olivia','screen')),
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT
);
CREATE INDEX posts_feed_idx ON posts(status,id DESC);
CREATE INDEX posts_fandom_idx ON posts(fandom_id,status,id DESC);
CREATE INDEX posts_user_idx ON posts(user_id,id DESC);
CREATE TABLE post_likes (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(user_id,post_id));
CREATE TABLE post_bookmarks (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(user_id,post_id));
CREATE TABLE replies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX replies_post_idx ON replies(post_id,status,id DESC);
CREATE TABLE blocks (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,blocked_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,CHECK(user_id!=blocked_id),PRIMARY KEY(user_id,blocked_id));
CREATE TABLE reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reporter_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 reviewed_by TEXT REFERENCES user(id),
 review_note TEXT,
 UNIQUE(reporter_id,post_id)
);
CREATE INDEX reports_queue_idx ON reports(status,id DESC);
CREATE TABLE audit_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT NOT NULL REFERENCES user(id),
 action TEXT NOT NULL,
 target_type TEXT NOT NULL,
 target_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE app_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window INTEGER NOT NULL);
CREATE TABLE app_meta (version INTEGER PRIMARY KEY);
INSERT INTO app_meta(version) VALUES (1);
CREATE TABLE follows (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,following_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,CHECK(user_id!=following_id),PRIMARY KEY(user_id,following_id));
CREATE INDEX follows_target_idx ON follows(following_id);
