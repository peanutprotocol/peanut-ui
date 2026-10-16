-- Additive screenshot votes. Neutral rows retain revisions and prevent ABA writes.
CREATE TABLE IF NOT EXISTS screen_vote_scopes (
 scope_key TEXT PRIMARY KEY, scope_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS screen_votes (
 actor_id TEXT NOT NULL, scope_key TEXT NOT NULL REFERENCES screen_vote_scopes(scope_key),
 value INTEGER NOT NULL CHECK (value IN (-1, 0, 1)),
 version INTEGER NOT NULL CHECK (version >= 1),
 PRIMARY KEY (actor_id, scope_key)
);
CREATE INDEX IF NOT EXISTS screen_votes_scope_value ON screen_votes(scope_key, value);
