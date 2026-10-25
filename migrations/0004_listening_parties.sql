CREATE TABLE listening_parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fandom_id TEXT NOT NULL REFERENCES fandoms(id),
  host_id TEXT NOT NULL REFERENCES profiles(user_id),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1500),
  starts_at TEXT NOT NULL,
  stationhead_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','live','ended','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX listening_parties_directory ON listening_parties(fandom_id,id DESC);
CREATE TABLE party_rsvps (
  party_id INTEGER NOT NULL REFERENCES listening_parties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id),
  choice TEXT NOT NULL CHECK(choice IN ('going','interested')),
  PRIMARY KEY(party_id,user_id)
);
CREATE TABLE party_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES listening_parties(id),
  reporter_id TEXT NOT NULL REFERENCES profiles(user_id),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(party_id,reporter_id)
);
