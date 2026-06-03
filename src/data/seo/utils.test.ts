import { displayNameFromContent, titleCaseSlug } from './utils'

describe('displayNameFromContent', () => {
    it('returns the frontmatter name when present', () => {
        expect(displayNameFromContent('wise', { name: 'Wise' })).toBe('Wise')
    })

    it('trims surrounding whitespace from the frontmatter name', () => {
        // Validated with .trim() but used to return the raw value — whitespace
        // leaked into breadcrumbs / link text.
        expect(displayNameFromContent('wise', { name: '  Wise  ' })).toBe('Wise')
        expect(displayNameFromContent('wise', { name: 'Wise\n' })).toBe('Wise')
    })

    it('falls back to title-cased slug for missing / blank / non-string names', () => {
        expect(displayNameFromContent('western-union', undefined)).toBe('Western Union')
        expect(displayNameFromContent('western-union', { name: '   ' })).toBe('Western Union')
        expect(displayNameFromContent('western-union', { name: 42 })).toBe('Western Union')
        expect(displayNameFromContent('western-union', null)).toBe('Western Union')
    })
})

describe('titleCaseSlug', () => {
    it('title-cases a kebab slug', () => {
        expect(titleCaseSlug('united-kingdom')).toBe('United Kingdom')
        expect(titleCaseSlug('binance-p2p')).toBe('Binance P2p')
    })
})
