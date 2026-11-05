import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'
import Title from '@/components/0_Bruddle/Title'
import { KnerdPullHeadline } from '@/components/Marketing/StarLp/KnerdPullHeadline'
import { KnerdPullSupport } from '@/components/Marketing/StarLp/KnerdPullSupport'
import { knerdPullFitStyle, knerdPullLineEm } from '@/components/Marketing/StarLp/starLpHeroFit'

jest.mock('@/components/Marketing/StarLp/useKnerdFollowThePull', () => ({ useKnerdFollowThePull: () => null }))

const KIT = join(__dirname, '..')
const kitFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : kitFiles(path)
        return /\.tsx?$/.test(name) ? [path] : []
    })

describe('Follow the pull headline', () => {
    it('renders the wide phrase and the stacked lines, letters hidden, one accessible name', () => {
        render(
            <section>
                <KnerdPullSupport />
                <h1>
                    <KnerdPullHeadline text={'Send\nthis.'} />
                </h1>
            </section>
        )
        const h1 = screen.getByRole('heading', { level: 1 })
        const wide = h1.querySelector('.star-lp-knerd-wide')!
        const stacked = h1.querySelector('.star-lp-knerd-stacked')!
        expect(wide.querySelectorAll('[aria-hidden] > [data-knerd-letter]').length).toBe(9)
        expect(stacked.querySelectorAll('[aria-hidden]')).toHaveLength(2)
        // each copy names itself once; CSS (display:none) drops the hidden copy from the tree
        expect(wide.querySelector('.sr-only')).toHaveTextContent(/^Send this\.$/)
        expect(stacked.querySelector('.sr-only')).toHaveTextContent(/^Send this\.$/)
        // the help text describes the headline from outside the h1, so the heading's text is only its words
        const root = h1.querySelector('[data-knerd-pull]')!
        expect(root).toHaveAttribute('tabindex', '0')
        const help = document.getElementById(root.getAttribute('aria-describedby')!)
        expect(help).toHaveAttribute('hidden')
        expect(h1).not.toContainElement(help)
        expect(h1.querySelector('noscript')).toBeNull()
        // the letters paint from data-knerd-char, so the phrase is text once, in the sr-only copy
        expect(wide.querySelector('[aria-hidden]')!.textContent).toBe('')
        expect(root.getAttribute('data-knerd-pull')).toBe('pending')
    })

    it('sets the join word inside the line, outside the letters', () => {
        const { container } = render(<KnerdPullHeadline text={'US\nand Europe'} join="and" />)
        const stacked = container.querySelector('.star-lp-knerd-stacked')!
        const [line1, line2] = [...stacked.querySelectorAll('[aria-hidden]')]
        expect(line1.querySelectorAll('[data-knerd-letter]')).toHaveLength(2)
        expect(line2.firstElementChild).toHaveAttribute('data-knerd-join')
        expect(line2.querySelectorAll('[data-knerd-letter]')).toHaveLength(6)
        // line 1 tilts −2°, line 2 0.5° shifted right: knerdTitle's line treatment
        expect((line1 as HTMLElement).style.transform).toBe('rotate(-2deg) translateX(0)')
        expect((line2 as HTMLElement).style.transform).toBe('rotate(0.5deg) translateX(0.02em)')
    })

    it('fits from the letter widths', () => {
        // US + join(0.24 × (1.748 + 0.6)) + EUROPE
        expect(knerdPullLineEm('US and Europe', 'and')).toBeCloseTo(1.259 + 0.24 * 2.348 + 3.572, 3)
        expect(knerdPullLineEm('In pink')).toBeCloseTo(0.254 + 0.786 + 0.24 + 0.583 + 0.254 + 0.786 + 0.639, 3)
        expect(knerdPullFitStyle('No\nproblem')).toEqual({
            '--knerd-em-wide': knerdPullLineEm('No problem').toFixed(3),
            '--knerd-em-stacked': knerdPullLineEm('problem').toFixed(3),
            '--knerd-lines-stacked': 2,
        })
    })

    it('keeps one fill and one offset outline in every letter', () => {
        const { container } = render(<Title text="In" letters />)
        const glyph = container.querySelector('[data-knerd-glyph]')!
        expect(glyph.className).toContain('font-knerd-filled')
        const outline = glyph.lastElementChild as HTMLElement
        expect(outline.className).toContain('font-knerd-outline')
        expect(outline.style.transform).toBe('translate(-3px, -2px) scale(1)')
    })

    it('leaves the static Title as it was', () => {
        const { container } = render(<Title text={'Only\nyours'} />)
        const [fill, outline] = [...container.firstElementChild!.children]
        expect(fill.className).toBe('block font-knerd-filled text-white')
        expect(outline).toHaveAttribute('aria-hidden')
        expect(fill.textContent).toBe('Only yours')
    })

    it('anchors a mark on its word once, in a ground-coloured knockout under the white fill', () => {
        const { container } = render(
            <Title
                text={'Tap\nin pink'}
                mark={{ word: 'pink', node: <i data-testid="mark" />, knockoutClassName: 'text-background-brand' }}
            />
        )
        expect(screen.getAllByTestId('mark')).toHaveLength(1)
        expect(screen.getByTestId('mark').parentElement).toHaveTextContent(/^pink$/)
        const [knockout, fill, outline] = Array.from(container.firstElementChild!.children)
        expect(knockout).toHaveClass('text-background-brand')
        expect(knockout).toContainElement(screen.getByTestId('mark'))
        expect(fill).toHaveClass('relative', 'text-white')
        expect(outline).toHaveAttribute('aria-hidden')
    })

    it('names the Knerd face nowhere in the star-LP kit (design.md: no bare font-knerd-* outside Title.tsx)', () => {
        const hits = kitFiles(KIT).filter((path) => /(?<![a-zA-Z0-9-])font-knerd/.test(readFileSync(path, 'utf8')))
        expect(hits).toEqual([])
    })
})
