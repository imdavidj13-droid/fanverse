-- Canonical catalogue identities. Albums remain topics inside an artist fandom.
CREATE TABLE fandoms (
 id TEXT PRIMARY KEY,
 wikidata_id TEXT UNIQUE,
 slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 kind TEXT NOT NULL CHECK(kind IN ('artist','tv','film','hub')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','merged')),
 merged_into TEXT REFERENCES fandoms(id),
 source_revision INTEGER,
 created_by TEXT REFERENCES user(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((status='merged' AND merged_into IS NOT NULL AND merged_into!=id) OR (status!='merged' AND merged_into IS NULL))
);
INSERT INTO fandoms(id,wikidata_id,slug,name,description,kind) VALUES
 ('taylor','Q26876','taylor-swift','Taylor Swift','American singer-songwriter','artist'),
 ('sabrina','Q7396400','sabrina-carpenter','Sabrina Carpenter','American singer-songwriter and actress','artist'),
 ('olivia','Q63243883','olivia-rodrigo','Olivia Rodrigo','American singer-songwriter and actress','artist'),
 ('screen',NULL,'tv-and-film','TV & Film','General screen discussion hub','hub');
CREATE TABLE fandom_source_ids(qid TEXT PRIMARY KEY,fandom_id TEXT NOT NULL REFERENCES fandoms(id));
INSERT INTO fandom_source_ids(qid,fandom_id) SELECT wikidata_id,id FROM fandoms WHERE wikidata_id IS NOT NULL;
CREATE TABLE fandom_aliases(fandom_id TEXT NOT NULL REFERENCES fandoms(id),alias TEXT NOT NULL,normalized_alias TEXT NOT NULL,PRIMARY KEY(fandom_id,normalized_alias));
CREATE INDEX fandom_alias_lookup ON fandom_aliases(normalized_alias);
CREATE TABLE fandom_requests(
 qid TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL,
 source_kind TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by TEXT NOT NULL REFERENCES user(id),
 reviewed_by TEXT REFERENCES user(id),
 review_note TEXT,
 fandom_id TEXT REFERENCES fandoms(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX fandom_requests_queue ON fandom_requests(status,created_at);
CREATE TABLE _catalogue_003_posts AS SELECT * FROM posts;
CREATE TABLE _catalogue_003_fandom_memberships AS SELECT * FROM fandom_memberships;
CREATE TABLE _catalogue_003_post_likes AS SELECT * FROM post_likes;
CREATE TABLE _catalogue_003_post_bookmarks AS SELECT * FROM post_bookmarks;
CREATE TABLE _catalogue_003_replies AS SELECT * FROM replies;
CREATE TABLE _catalogue_003_reports AS SELECT * FROM reports;
DROP TABLE post_likes;
DROP TABLE post_bookmarks;
DROP TABLE replies;
DROP TABLE reports;
DROP TABLE fandom_memberships;
DROP TABLE posts;
CREATE TABLE posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 fandom_id TEXT NOT NULL REFERENCES fandoms(id),
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT
);
INSERT INTO posts SELECT * FROM _catalogue_003_posts;
CREATE TABLE fandom_memberships (
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 fandom_id TEXT NOT NULL REFERENCES fandoms(id),
 PRIMARY KEY(user_id,fandom_id)
);
INSERT INTO fandom_memberships SELECT * FROM _catalogue_003_fandom_memberships;
CREATE TABLE post_likes (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(user_id,post_id));
INSERT INTO post_likes SELECT * FROM _catalogue_003_post_likes;
CREATE TABLE post_bookmarks (user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(user_id,post_id));
INSERT INTO post_bookmarks SELECT * FROM _catalogue_003_post_bookmarks;
CREATE TABLE replies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 500),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO replies SELECT * FROM _catalogue_003_replies;
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
INSERT INTO reports SELECT * FROM _catalogue_003_reports;
CREATE INDEX posts_feed_idx ON posts(status,id DESC);
CREATE INDEX posts_fandom_idx ON posts(fandom_id,status,id DESC);
CREATE INDEX posts_user_idx ON posts(user_id,id DESC);
CREATE INDEX replies_post_idx ON replies(post_id,status,id DESC);
CREATE INDEX reports_queue_idx ON reports(status,id DESC);
DROP TABLE _catalogue_003_reports;
DROP TABLE _catalogue_003_replies;
DROP TABLE _catalogue_003_post_bookmarks;
DROP TABLE _catalogue_003_post_likes;
DROP TABLE _catalogue_003_fandom_memberships;
DROP TABLE _catalogue_003_posts;
UPDATE app_meta SET version=2 WHERE version=1;
