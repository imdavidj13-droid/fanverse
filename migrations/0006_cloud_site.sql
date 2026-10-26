CREATE TABLE profile_details (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 avatar TEXT NOT NULL DEFAULT '',
 theme TEXT NOT NULL DEFAULT '{}',
 preferences TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE post_details (
 post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
 image TEXT NOT NULL DEFAULT '', image_alt TEXT NOT NULL DEFAULT '',
 poll TEXT NOT NULL DEFAULT '[]', spoiler INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE post_reposts (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,post_id));
CREATE TABLE poll_votes (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,choice INTEGER NOT NULL,PRIMARY KEY(user_id,post_id));
CREATE TABLE account_mutes (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,muted_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,PRIMARY KEY(user_id,muted_id));
CREATE TABLE hidden_fandoms (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,fandom_id TEXT NOT NULL REFERENCES fandoms(id),PRIMARY KEY(user_id,fandom_id));
CREATE TABLE bookmark_collections (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,name TEXT NOT NULL,UNIQUE(user_id,name));
CREATE TABLE bookmark_folders (user_id TEXT NOT NULL,post_id INTEGER NOT NULL,collection_id TEXT NOT NULL REFERENCES bookmark_collections(id) ON DELETE CASCADE,PRIMARY KEY(user_id,post_id),FOREIGN KEY(user_id,post_id) REFERENCES post_bookmarks(user_id,post_id) ON DELETE CASCADE);
CREATE TABLE cloud_drafts (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,context TEXT NOT NULL,content TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(user_id,context));
CREATE TABLE direct_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,sender_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,recipient_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,text TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),read_at TEXT);
CREATE INDEX messages_recipient_idx ON direct_messages(recipient_id,id DESC);
CREATE INDEX messages_sender_idx ON direct_messages(sender_id,id DESC);
CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,kind TEXT NOT NULL,post_id INTEGER,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),read_at TEXT);
CREATE INDEX notifications_user_idx ON notifications(user_id,id DESC);
CREATE TRIGGER notify_like AFTER INSERT ON post_likes WHEN NEW.user_id != (SELECT user_id FROM posts WHERE id=NEW.post_id) BEGIN
 INSERT INTO notifications(user_id,actor_id,kind,post_id) SELECT user_id,NEW.user_id,'like',NEW.post_id FROM posts WHERE id=NEW.post_id;
END;
CREATE TRIGGER notify_reply AFTER INSERT ON replies WHEN NEW.user_id != (SELECT user_id FROM posts WHERE id=NEW.post_id) BEGIN
 INSERT INTO notifications(user_id,actor_id,kind,post_id) SELECT user_id,NEW.user_id,'reply',NEW.post_id FROM posts WHERE id=NEW.post_id;
END;
CREATE TRIGGER notify_follow AFTER INSERT ON follows BEGIN
 INSERT INTO notifications(user_id,actor_id,kind) VALUES(NEW.following_id,NEW.user_id,'follow');
END;
CREATE TABLE fandom_events (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES user(id),fandom_id TEXT NOT NULL REFERENCES fandoms(id),title TEXT NOT NULL,starts_at TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'scheduled');
CREATE TABLE event_rsvps (event_id INTEGER NOT NULL REFERENCES fandom_events(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,PRIMARY KEY(event_id,user_id));
