/** One entry guard: when `ok` is false the step cannot render and the stepper
 * replaces it with `fallback` (or the flow's default step). */
export interface FlowStepGuard<Step extends string> {
    ok: boolean
    fallback?: Step
}

export interface FlowStepperOptions<Step extends string> {
    /**
     * Ordered list of the flow's named screen ids. The ids appear verbatim in
     * the URL (`?step=review`) — never indexes. Order defines the default
     * back path.
     */
    steps: readonly Step[]
    /** Step used when the URL carries no step param. Defaults to the first step. */
    defaultStep?: Step
    /** URL param name. Defaults to `step`. */
    urlKey?: string
    /**
     * Per-step entry guards. A refresh or deep link can put the URL on a step
     * whose prerequisites live in flow memory that did not survive — the guard
     * redirects it instead of rendering a dead screen.
     */
    guards?: Partial<Record<Step, FlowStepGuard<Step>>>
    /** Per-step back overrides, for flows whose back path is not linear. */
    backMap?: Partial<Record<Step, Step>>
    /** Called when back() fires on the first step — leave the flow here. */
    onExit?: () => void
}

export interface FlowStepper<Step extends string> {
    /** The step to render now (guards already applied). */
    step: Step
    /** Jump to a step. Resolves once the URL write lands. */
    goTo: (step: Step) => Promise<unknown>
    /** Go to the previous step (backMap first, then list order); calls onExit on the first step. */
    back: () => Promise<unknown>
    /** Clear the step param — the flow returns to its default step. */
    reset: () => Promise<unknown>
    /** True when the current step has no previous step. */
    isFirst: boolean
}
