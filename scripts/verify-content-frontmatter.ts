import matter from 'gray-matter'

export function parseContentFrontmatter(content: string): Record<string, unknown> {
    return matter(content).data as Record<string, unknown>
}

/** Match the application's publication contract: only YAML boolean false is a draft. */
export function isPublishedContent(content: string): boolean {
    return parseContentFrontmatter(content).published !== false
}
