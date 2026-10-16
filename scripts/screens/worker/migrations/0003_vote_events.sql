-- Additive vote activity for the feed. screen_votes stays the current state; one row per accepted change.
CREATE TABLE IF NOT EXISTS screen_vote_events (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
 scope_key TEXT NOT NULL REFERENCES screen_vote_scopes(scope_key),
 value INTEGER NOT NULL CHECK (value IN (-1, 0, 1)),
 previous_value INTEGER NOT NULL CHECK (previous_value IN (-1, 0, 1)),
 pr_number INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS screen_vote_events_feed ON screen_vote_events(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS screen_vote_events_pr_feed ON screen_vote_events(pr_number, created_at DESC, id DESC);
