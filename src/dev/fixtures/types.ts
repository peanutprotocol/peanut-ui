/** A complete answer for one route: the body AND the status it is served with. */
export type FixtureReply = { status: number; body: unknown }

/** One named app state — a screen plus the API answers that produce it. */
export type Fixture = {
    /** Route the fixture is built for. The listing page links here with the param applied. */
    route: string
    /** What the fixture proves. One line, shown on /dev/fixtures. */
    about: string
    /**
     * Overrides on top of the demo-api response, keyed `METHOD /path`.
     * Deep-merged: objects merge key by key, arrays and primitives replace.
     * So an empty state is `{ entries: [] }` and a renamed user is one line.
     */
    responses?: Record<string, unknown>
    /**
     * Whole replies keyed `METHOD /path`, replacing the demo answer and its
     * status. `responses` keeps the demo status, so a route the offline demo
     * answers 503 (GET /fx/rate) can never become a success through it. A
     * function receives the requested path, query included, and may answer
     * null to fall through to the demo default — a rate reply answers its one
     * pair only. `fails` still wins over a reply.
     */
    replies?: Record<string, FixtureReply | ((path: string) => FixtureReply | null)>
    /** `METHOD /path` keys that answer 500, for error-state screens. */
    fails?: string[]
    /**
     * Set when the state under test IS a loader — a screen waiting on a
     * provider that will not answer inside a fixture. The capture normally
     * fails on a visible loader, because a run that photographs 120 spinners
     * looks exactly like a run that photographed 120 screens. A fixture that
     * says so on purpose is the one case where that check has to stand down.
     */
    isLoadingState?: true
    /**
     * Capture the whole scrollable page instead of the viewport. For a fixture
     * whose subject sits below the fold at 320 — a secondary link under a form
     * — where a viewport shot proves nothing.
     */
    fullPage?: true
    /**
     * A selector the capture waits for before it shoots. On an `isLoadingState`
     * fixture it names the loader the fixture is for, rather than whatever
     * loader the app happens to show first. On any other fixture it names a
     * subject that arrives after the page has settled — a debounced validation
     * message, say — so the shot is not the frame before it.
     */
    waitFor?: string
}
