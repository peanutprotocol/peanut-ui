import { render } from '@testing-library/react'
import { SEOFooter } from '../SEOFooter'

// Localization behavior stays covered without retaining retired production pages.
jest.mock('@/data/seo/country-display', () => {
    const iso2BySlug: Record<string, string> = {
        brazil: 'br',
        germany: 'de',
        france: 'fr',
        'united-states': 'us',
        portugal: 'pt',
    }
    return { countryIso2: (slug: string) => iso2BySlug[slug] }
})
jest.mock('@/content/generated/footer-manifest.json', () => ({
    sendMoney: {
        to: [{ slug: 'brazil', name: 'Brazil', href: '/en/send-money-to/brazil' }],
        from: [
            { slug: 'germany', name: 'Germany', href: '/en/send-money-from/germany/to/brazil' },
            { slug: 'france', name: 'France', href: '/en/send-money-from/france/to/brazil' },
            { slug: 'united-states', name: 'US', href: '/en/send-money-from/united-states/to/brazil' },
            { slug: 'portugal', name: 'Portugal', href: '/en/send-money-from/portugal/to/brazil' },
        ],
    },
}))

const linkTexts = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].map((link) => link.textContent)

it('names send-money countries in the page language', () => {
    const texts = linkTexts(render(<SEOFooter locale="es-419" />).container)
    expect(texts).toEqual(expect.arrayContaining(['Enviar a Brasil', 'Enviar desde Alemania']))
    expect(texts).not.toContain('Enviar a Brazil')
    expect(linkTexts(render(<SEOFooter locale="en" />).container)).toContain('Send from US')
})

it('gives pt-BR send-from links the article the country takes', () => {
    const texts = linkTexts(render(<SEOFooter locale="pt-br" />).container)
    expect(texts).toEqual(
        expect.arrayContaining(['Enviar da França', 'Enviar dos Estados Unidos', 'Enviar de Portugal'])
    )
    expect(texts).not.toContain('Enviar de França')
})
