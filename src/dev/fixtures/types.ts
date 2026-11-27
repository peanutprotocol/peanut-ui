export const OPEN_DIALOG = '[role="dialog"]:not([aria-modal="false"])'
export const HOME_ADD_DRAWER_CHECKPOINT = '[role="dialog"][data-state="open"] [data-testid="home-drawer-add-more"]'
export type CaptureRecipe = {
    /** Optional stable control(s) to reach the state before capture. */
    actions?: Array<
        | { click: string }
        | { clickSelector: string }
        | { tap: string }
        | { tapSelector: string }
        | { reveal: string }
        | { fill: { selector: string; value: string } }
    >
    /** Visible component-owned evidence that the requested state rendered. */
    expectSelector?: string
    requiresSource?: string
}

/** One named app state — a screen plus the API answers that produce it. */
export type Fixture = {
    /** Route the fixture is built for. The listing page links here with the param applied. */
    route: string
    /**
     * Where the app sends the user from `route`, when that screen is the state
     * under test. The capture opens `route` and shoots once it lands here.
     */
    landsOn?: string
    /** Optional interaction and visible evidence supplied by the state owner. */
    capture?: CaptureRecipe
    /** Additional named views of the same fixture, e.g. a drawer reached from its page. */
    views?: Array<
        CaptureRecipe & {
            id: string
            name: string
            flow: string
            route: string
            camera?: 'synthetic' | 'denied'
            clickTestIds?: string[]
        }
    >
    /** What the fixture proves. One line, shown on /dev/fixtures. */
    about: string
    /**
     * Session storage the screen reads as it loads, seeded before the first
     * navigation: a form that never rides in the URL, such as the Pix withdraw
     * draft, which holds a Pix key.
     */
    sessionStorage?: Record<string, string>
    /**
     * Overrides on top of the demo-api response, keyed `METHOD /path`.
     * Deep-merged: objects merge key by key, arrays and primitives replace.
     * So an empty state is `{ entries: [] }` and a renamed user is one line.
     */
    responses?: Record<string, unknown>
    /** Entries in responses that specify the entire answer, including which fields are absent. */
    completeResponses?: string[]
    /**
     * Wallet balance in USD, e.g. `'0.17'`. The balance is not an API answer —
     * fixtures ride the demo balance overlay — so a state that depends on it
     * (the Home checklist's "Add money") says it here.
     */
    balance?: string
    /**
     * The balance once a watched crypto deposit lands: after a `GET /rhino/status/*`
     * answer reads `completed`, the fixture serves this instead of `balance`, as
     * the backend would credit the deposit. For a screen that reacts to the new balance.
     */
    balanceAfterDeposit?: string
    /** ISO 3166-1 alpha-2 country to seed for IP geolocation in screenshots. */
    geoCountry?: string
    /** `METHOD /path` keys that answer 500, for error-state screens. */
    fails?: string[]
    /**
     * `METHOD /path` keys that answer an API refusal: the 4xx status and the
     * body the API sends with it, `code` included. For screens that branch on a
     * typed refusal rather than on a 500.
     */
    rejects?: Record<string, { status: number; body: Record<string, unknown> }>
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
