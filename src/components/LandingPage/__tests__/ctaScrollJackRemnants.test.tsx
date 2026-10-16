/**
 * The scroll-jack drove the hero CTA through a `--cta-scale` custom property
 * and anchored itself on `#sticky-button-target` in the send-in-seconds fold.
 * Both are gone. Marketing CTAs are plain DS Buttons in link mode — one
 * anchor, never a Button nested in a link — carrying the marketing CTA motion
 * layer (`.cta-motion`, ruled 2026-10-16) on the Button itself.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'
import { Hero } from '../hero'
import { SendInSeconds } from '../sendInSeconds'
import { landingStrings } from '../landingStrings'
import { EN_LANDING_CONTENT_HREFS } from '../landingContentHrefs'
import { getTranslations } from '@/i18n'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

const strings = landingStrings(getTranslations('en'))

describe('Hero CTA', () => {
    it('renders the CTA as one button-shaped link carrying the motion layer, with no scale property', () => {
        const { container } = render(
            <Hero
                strings={strings}
                contentHrefs={EN_LANDING_CONTENT_HREFS}
                buttonVisible
                primaryCta={{ label: 'Sign up', href: '/setup' }}
            />
        )

        const cta = screen.getByRole('link', { name: 'Sign up' })
        expect(cta).toHaveAttribute('href', '/setup')
        expect(cta).toHaveClass('btn', 'btn-secondary', 'w-fit', 'cta-motion')
        expect(cta.querySelector('a, button')).toBeNull()
        // one motion layer: only the Button carries the class
        expect(container.querySelectorAll('.cta-motion')).toHaveLength(1)
        expect(container.innerHTML).not.toContain('--cta-scale')
    })

    it('fades and parks the CTA while the footer is on screen', () => {
        render(
            <Hero
                strings={strings}
                contentHrefs={EN_LANDING_CONTENT_HREFS}
                buttonVisible={false}
                primaryCta={{ label: 'Sign up', href: '/setup' }}
            />
        )

        const holder = screen.getByRole('link', { name: 'Sign up' }).parentElement as HTMLElement
        expect(holder.style.opacity).toBe('0')
        expect(holder.style.pointerEvents).toBe('none')
        expect(holder.style.getPropertyValue('--cta-x')).toBe('20px')
        expect(holder.style.getPropertyValue('--cta-r')).toBe('1deg')
    })

    it('rests the CTA in place while it is visible', () => {
        render(
            <Hero
                strings={strings}
                contentHrefs={EN_LANDING_CONTENT_HREFS}
                buttonVisible
                primaryCta={{ label: 'Sign up', href: '/setup' }}
            />
        )

        const holder = screen.getByRole('link', { name: 'Sign up' }).parentElement as HTMLElement
        expect(holder.style.opacity).toBe('1')
        expect(holder.style.getPropertyValue('--cta-x')).toBe('0px')
        expect(holder.style.getPropertyValue('--cta-y')).toBe('0px')
    })

    it('keeps rendering a custom CTA', () => {
        render(
            <Hero
                strings={strings}
                contentHrefs={EN_LANDING_CONTENT_HREFS}
                buttonVisible
                customCta={<span>store pair</span>}
            />
        )

        expect(screen.getByText('store pair')).toBeInTheDocument()
    })
})

describe('SendInSeconds fold', () => {
    // The scroll-jack regression guard. Keep it free of fold-10 content assertions.
    it('drops the scroll-jack target but keeps the section anchor', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        expect(container.querySelector('#send-in-seconds')).toBeInTheDocument()
        expect(container.querySelector('#sticky-button-target')).toBeNull()
    })

    it('links the CTA to /send as a single hugging DS button with the motion layer', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        const cta = container.querySelector('a[href="/send"]')
        expect(cta).toBeInTheDocument()
        expect(cta).toHaveClass('btn', 'btn-secondary', 'w-fit', 'cta-motion')
        expect(container.querySelectorAll('.cta-motion')).toHaveLength(1)
    })
})

describe('marketing CTA motion layer (globals.css)', () => {
    const css = readFileSync(join(__dirname, '..', '..', '..', 'styles', 'globals.css'), 'utf8')
    const block = (selectorPattern: string) => css.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

    it('moves on the DS ease-spring token, never an off-token curve', () => {
        const base = block('\\n\\.cta-motion')
        expect(base).toContain('var(--ease-spring)')
        expect(base).not.toMatch(/cubic-bezier/)
        expect(base).toContain('animation: cta-enter')
    })

    it('gates the hover drop-and-tilt on real hover and on motion being allowed', () => {
        expect(css).toMatch(
            /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)\s*\{\s*\.cta-motion:not\(:disabled\):hover/
        )
    })

    it('stands the layer down under prefers-reduced-motion', () => {
        // each top-level reduced-motion block ends at its column-0 closing brace
        const reduce = css
            .split('@media (prefers-reduced-motion: reduce)')
            .slice(1)
            .map((chunk) => chunk.split('\n}')[0].match(/\.cta-motion\s*\{([^}]*)\}/)?.[1])
            .find(Boolean)
        expect(reduce).toBeDefined()
        expect(reduce).toContain('animation: none')
        expect(reduce).toContain('transform: none')
    })
})
