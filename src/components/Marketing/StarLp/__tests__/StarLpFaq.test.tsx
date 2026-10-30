import { render, screen } from '@testing-library/react'
import { StarLpFaq } from '../StarLpFaq'

jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const items = [
    {
        id: 'cost',
        question: '¿Cuánto cuesta?',
        answer: 'Abrir tus cuentas no tiene costo.',
        learnMoreHref: '/es-ar/fees',
    },
    { id: 'freeze', question: '¿Peanut puede congelar mi plata?', answer: 'No.' },
]

const schema = (container: HTMLElement) =>
    JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)

describe('StarLpFaq', () => {
    it('keeps the star-LP output: "FAQ.", no language on the schema, no learn-more links', () => {
        const { container } = render(<StarLpFaq items={items} />)
        expect(screen.getByRole('heading', { name: 'FAQ.' })).toBeInTheDocument()
        expect(schema(container)).not.toHaveProperty('inLanguage')
        expect(container.querySelector('a[href="/es-ar/fees"]')).toBeNull()
        expect(container.querySelector('section')).not.toHaveAttribute('id')
    })

    it('tags the FAQPage schema with the page language and links items that carry a help page', () => {
        const { container } = render(
            <StarLpFaq
                items={items}
                inLanguage="es-AR"
                learnMoreLabel="Más info"
                id="faq"
                footnote="Peanut no es un banco."
            />
        )
        const json = schema(container)
        expect(json['@type']).toBe('FAQPage')
        expect(json.inLanguage).toBe('es-AR')
        expect(json.mainEntity).toHaveLength(2)
        expect(container.querySelector('section#faq')).not.toBeNull()
        const links = container.querySelectorAll('a[href="/es-ar/fees"]')
        expect(links).toHaveLength(1)
        expect(links[0]).toHaveTextContent('Más info')
        expect(screen.getByText('Peanut no es un banco.')).toBeInTheDocument()
    })
})
