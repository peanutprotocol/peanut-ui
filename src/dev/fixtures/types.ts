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
    /** `METHOD /path` keys that answer 500, for error-state screens. */
    fails?: string[]
}
