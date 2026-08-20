import { linkTerms, type LinkedTerm } from '../landingLinks.utils'

// the real city terms the "global cash" line links, aliases and all
const CITIES: LinkedTerm[] = [
    { aliases: ['New York', 'Nueva York', 'Nova York'], href: '/en/united-states' },
    { aliases: ['Madrid', 'Madri'], href: '/en/spain' },
    { aliases: ['Mexico City', 'Ciudad de México', 'Cidade do México'], href: '/en/mexico' },
]

describe('linkTerms', () => {
    it('links every city in the English line, in reading order', () => {
        const parts = linkTerms('From New York to Madrid to Mexico City — send and share instantly.', CITIES)

        expect(parts).toEqual([
            { text: 'From ' },
            { text: 'New York', href: '/en/united-states' },
            { text: ' to ' },
            { text: 'Madrid', href: '/en/spain' },
            { text: ' to ' },
            { text: 'Mexico City', href: '/en/mexico' },
            { text: ' — send and share instantly.' },
        ])
    })

    it.each([
        ['es-419', 'De Nueva York a Madrid y Ciudad de México: envía y comparte al instante.'],
        ['es-ar', 'De Nueva York a Madrid y Ciudad de México: enviá y compartí al instante.'],
        ['pt-br', 'De Nova York a Madri e à Cidade do México: envie e compartilhe na hora.'],
    ])('links all three cities in the %s translation', (_locale, line) => {
        const linked = linkTerms(line, CITIES).filter((p) => p.href)

        expect(linked.map((p) => p.href)).toEqual(['/en/united-states', '/en/spain', '/en/mexico'])
        // the sentence survives the split intact
        expect(
            linkTerms(line, CITIES)
                .map((p) => p.text)
                .join('')
        ).toBe(line)
    })

    it('keeps "Madrid" whole rather than matching its prefix "Madri"', () => {
        const parts = linkTerms('to Madrid today', [{ aliases: ['Madri', 'Madrid'], href: '/en/spain' }])

        expect(parts).toEqual([{ text: 'to ' }, { text: 'Madrid', href: '/en/spain' }, { text: ' today' }])
    })

    it('renders plain text for a term the translation does not contain', () => {
        const parts = linkTerms('Send money anywhere.', CITIES)

        expect(parts).toEqual([{ text: 'Send money anywhere.' }])
    })

    it('drops a term that overlaps one already matched instead of nesting it', () => {
        const parts = linkTerms('New York', [
            { aliases: ['New York'], href: '/en/united-states' },
            { aliases: ['York'], href: '/en/united-kingdom' },
        ])

        expect(parts).toEqual([{ text: 'New York', href: '/en/united-states' }])
    })
})
