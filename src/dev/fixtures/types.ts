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
     * Wallet balance in USD, e.g. `'0.17'`. The balance is not an API answer —
     * fixtures ride the demo balance overlay — so a state that depends on it
     * (the Home checklist's "Add money") says it here.
     */
    balance?: string
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
