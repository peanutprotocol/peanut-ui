// Display-name resolution for SEO loaders.
//
// Loaders read generated content frontmatter only (see lib/content.ts header
// for the mirror contract). Each generated page may carry a `name:` field
// denormalized from the input system; when it's absent we fall back to
// title-casing the slug.

interface Named {
    name?: unknown
}

/**
 * Resolve the display name for an entity slug from the content frontmatter,
 * falling back to a title-cased slug. The frontmatter value wins iff it's a
 * non-empty string — anything else (missing, null, number) falls through.
 */
export function displayNameFromContent(slug: string, frontmatter: Named | null | undefined): string {
    const name = frontmatter?.name
    if (typeof name === 'string' && name.trim().length > 0) return name.trim()
    return titleCaseSlug(slug)
}

/** Title-case a kebab-cased slug. Used as a last-resort display name. */
export function titleCaseSlug(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
