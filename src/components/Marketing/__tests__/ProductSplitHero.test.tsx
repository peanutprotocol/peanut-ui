import { render, screen } from '@testing-library/react'
import { ProductSplitHero } from '@/components/Marketing/ProductSplitHero'

jest.mock('@/components/Marketing/HeroBackNav', () => ({ HeroBackNav: () => null }))

describe('ProductSplitHero', () => {
    it("align='start' (/shhhhh) keeps the lead's Roboto Flex face and its 24px gap", () => {
        render(
            <ProductSplitHero
                headline="Card"
                lead="Lead line"
                cta={<button type="button">Go</button>}
                art={<div data-testid="art" />}
            />
        )
        const lead = screen.getByText('Lead line')
        expect(lead.className.split(' ')).toEqual(
            expect.arrayContaining(['font-roboto-flex', 'mt-6', 'text-body-l', 'max-w-xl'])
        )
        // CTA sits under the copy, before the art
        const cta = screen.getByText('Go')
        expect(cta.compareDocumentPosition(screen.getByTestId('art')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it("align='center' reads copy, art, CTA on phones and drops the Roboto Flex lead face", () => {
        render(
            <ProductSplitHero
                align="center"
                headline={<span>Mixed headline</span>}
                lead="Lead line"
                cta={<button type="button">Go</button>}
                art={<div data-testid="art" />}
            />
        )
        const lead = screen.getByText('Lead line')
        const classes = lead.className.split(' ')
        expect(classes).toEqual(expect.arrayContaining(['mt-6', 'text-body-l']))
        expect(classes).not.toContain('font-roboto-flex')
        const art = screen.getByTestId('art')
        expect(lead.compareDocumentPosition(art) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(art.compareDocumentPosition(screen.getByText('Go')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mixed headline')
    })
})
