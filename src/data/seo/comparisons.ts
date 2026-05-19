// Competitor comparison data, read from generated content only.
//
// Source: content/compare/{slug}/en.md frontmatter (mirror of mono/content/).
// The competitor display name comes from the `name:` field denormalized into
// the frontmatter at generation time (see mono/content/_system/templates/
// compare.md). When absent, we fall back to title-casing the slug.
//
// Structured fields (rows, pros/cons, verdict, FAQs) used to live here; they
// were retired in March 2026 when the rendering layer moved to MDX-as-prose
// (see commits bd0e575, 1d04ee1). The MDX body now carries all of that.

import { listContentSlugs, readPageContent } from '@/lib/content'
import { displayNameFromContent } from './utils'

export interface Competitor {
    name: string
}

function loadCompetitors(): Record<string, Competitor> {
    const result: Record<string, Competitor> = {}
    for (const slug of listContentSlugs('compare')) {
        const content = readPageContent<{ name?: unknown; published?: boolean }>('compare', slug, 'en')
        if (content && content.frontmatter.published === false) continue
        result[slug] = { name: displayNameFromContent(slug, content?.frontmatter) }
    }
    return result
}

export const COMPETITORS: Record<string, Competitor> = loadCompetitors()
