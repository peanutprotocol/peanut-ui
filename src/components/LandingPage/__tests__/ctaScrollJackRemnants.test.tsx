/**
 * The scroll-jack drove the hero CTA through a `--cta-scale` custom property
 * and anchored itself on `#sticky-button-target` in the send-in-seconds fold.
 * Both are gone, and so is the `.cta-motion` hover wobble: marketing CTAs are
 * plain DS Buttons that only press (design.md law 7), rendered in link mode —
 * one anchor, never a Button nested in a link.
 */
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
    it('renders the CTA as one button-shaped link with no motion custom properties', () => {
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
        expect(cta).toHaveClass('btn', 'btn-secondary', 'w-fit')
        expect(cta.querySelector('a, button')).toBeNull()
        expect(container.querySelector('.cta-motion')).toBeNull()
        expect(container.innerHTML).not.toContain('--cta-')
    })

    it('hides the CTA while the footer is on screen', () => {
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
    it('drops the scroll-jack target and the CTA motion class but keeps the section anchor', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        expect(container.querySelector('#send-in-seconds')).toBeInTheDocument()
        expect(container.querySelector('#sticky-button-target')).toBeNull()
        expect(container.querySelector('.cta-motion')).toBeNull()
    })

    it('links the CTA to /send as a single hugging DS button', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        const cta = container.querySelector('a[href="/send"]')
        expect(cta).toBeInTheDocument()
        expect(cta).toHaveClass('btn', 'btn-secondary', 'w-fit')
    })
})
