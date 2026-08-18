/** @jest-environment node */

import { isPublishedContent, parseContentFrontmatter } from '../verify-content-frontmatter'

describe('content verifier frontmatter', () => {
    it.each(['published: false', 'published: False', 'published: false # draft'])(
        'treats YAML boolean %s as unpublished',
        (publishedLine) => {
            expect(isPublishedContent(`---\n${publishedLine}\n---\nDraft`)).toBe(false)
        }
    )

    it('defaults missing publication state to published', () => {
        expect(isPublishedContent('---\ntitle: Published\n---\nBody')).toBe(true)
    })

    it('uses YAML parsing for the remaining frontmatter fields', () => {
        expect(parseContentFrontmatter('---\nskip_polish_check: true # reviewed\n---\nBody')).toMatchObject({
            skip_polish_check: true,
        })
    })
})
