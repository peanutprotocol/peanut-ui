-- Additive Screen Library discussion storage; no screenshot/content migration.
CREATE TABLE IF NOT EXISTS comment_threads (
 id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, scope_json TEXT NOT NULL,
 pr_number INTEGER, root_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
 resolved INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0, 1)),
 version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES comment_threads(id),
 body TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL,
 created_at INTEGER NOT NULL, edited_at INTEGER, pr_number INTEGER,
 version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
 is_root INTEGER NOT NULL CHECK (is_root IN (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS comments_one_root ON comments(thread_id) WHERE is_root = 1;
CREATE INDEX IF NOT EXISTS comment_threads_scope_page ON comment_threads(scope_key, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS comment_threads_pr ON comment_threads(pr_number, id);
CREATE INDEX IF NOT EXISTS comments_thread_page ON comments(thread_id, is_root, created_at, id);
CREATE INDEX IF NOT EXISTS comments_feed_page ON comments(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS comments_pr_feed_page ON comments(pr_number, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS comment_requests (
 actor_id TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 nonce TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY (actor_id, request_id)
);
