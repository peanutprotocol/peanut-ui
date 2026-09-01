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
    /**
     * `METHOD /path` → status code, with an empty body. For screens that read
     * a status rather than a payload: the signup username check treats 404 as
     * "available" and 200 as "taken", and the demo API answers 200 to
     * everything, so without this no fixture can reach the step after it.
     * `fails` stays as the shorthand for 500.
     */
    status?: Record<string, number>
}
