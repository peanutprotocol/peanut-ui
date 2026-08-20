/**
 * Template interpolation, split out of `@/i18n` so a client component can use it
 * without importing that module — which pulls all four locale catalogs into the
 * bundle. `@/i18n` re-exports it, so server callers are unchanged.
 */
export function t(template: string, vars?: Record<string, string>): string {
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}
