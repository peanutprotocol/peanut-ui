import { articleSchema } from '@/lib/seo/schemas'

const article = { title: 'A story', description: 'A description', url: '/en/stories/example' }

describe('articleSchema dates', () => {
    it('omits unknown publication and modification dates', () => {
        const schema = articleSchema(article)
        expect(schema['@type']).toBe('Article')
        expect(schema).not.toHaveProperty('datePublished')
        expect(schema).not.toHaveProperty('dateModified')
    })

    it('does not invent a modification date from a publication date', () => {
        const schema = articleSchema({ ...article, datePublished: '2026-03-20' })
        expect(schema.datePublished).toBe('2026-03-20')
        expect(schema).not.toHaveProperty('dateModified')
    })

    it('does not invent a publication date from a modification date', () => {
        const schema = articleSchema({ ...article, dateModified: '2026-04-15' })
        expect(schema).not.toHaveProperty('datePublished')
        expect(schema.dateModified).toBe('2026-04-15')
    })

    it('preserves the source article subtype and distinct dates', () => {
        expect(
            articleSchema({
                ...article,
                schemaType: 'BlogPosting',
                datePublished: '2026-03-20',
                dateModified: '2026-04-15',
                inLanguage: 'pt-br',
            })
        ).toMatchObject({
            '@type': 'BlogPosting',
            datePublished: '2026-03-20',
            dateModified: '2026-04-15',
            inLanguage: 'pt-br',
        })
    })
})
