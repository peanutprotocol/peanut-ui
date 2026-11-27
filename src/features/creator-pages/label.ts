/** An experiment or variant id: short, lowercase, safe in a cookie value and an event property. */
const CREATOR_PAGE_LABEL = /^[a-z0-9][a-z0-9-]{0,31}$/

export function isCreatorPageLabel(value: unknown): value is string {
    return typeof value === 'string' && CREATOR_PAGE_LABEL.test(value)
}
