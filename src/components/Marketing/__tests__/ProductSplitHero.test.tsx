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

    it("align='center' reads h1, art, tail, lead, CTA and drops the Roboto Flex lead face", () => {
        render(
            <ProductSplitHero
                align="center"
                headline={<span>Mixed headline</span>}
                headlineTail={<span>at the till.</span>}
                lead="Lead line"
                cta={<button type="button">Go</button>}
                art={<div data-testid="art" />}
            />
        )
        const lead = screen.getByText('Lead line')
        const classes = lead.className.split(' ')
        expect(classes).toEqual(expect.arrayContaining(['text-body-l']))
        expect(classes).not.toContain('font-roboto-flex')
        const art = screen.getByTestId('art')
        const h1 = screen.getByRole('heading', { level: 1 })
        expect(h1.compareDocumentPosition(art) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(art.compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(lead.compareDocumentPosition(screen.getByText('Go')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // the tail is part of the h1 for screen readers; its visible copy under the art is hidden from them
        expect(h1).toHaveTextContent('Mixed headline at the till.')
        const tails = screen.getAllByText('at the till.')
        expect(tails).toHaveLength(2)
        expect(tails.filter((el) => el.closest('[aria-hidden]'))).toHaveLength(1)
    })

    it("artPlacement='edge' puts the art after the CTA and takes the hero's bottom padding off", () => {
        const { container } = render(
            <ProductSplitHero
                align="center"
                artPlacement="edge"
                headline={<span>Headline</span>}
                cta={<button type="button">Go</button>}
                art={<div data-testid="art" />}
            />
        )
        expect(
            screen.getByText('Go').compareDocumentPosition(screen.getByTestId('art')) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
        expect(container.querySelector('section')?.className.split(' ')).toEqual(
            expect.arrayContaining(['psh-fit-edge', 'pb-0'])
        )
    })
})
