/**
 * The scroll-jack drove the hero CTA through a `--cta-scale` custom property
 * and anchored itself on `#sticky-button-target` in the send-in-seconds fold.
 * Both are gone; the `.cta-motion` / `.cta-enter` entrance stays.
 */
import { render } from '@testing-library/react'
import { Hero } from '../hero'
import { SendInSeconds } from '../sendInSeconds'
import { landingStrings } from '../landingStrings'
import { getTranslations } from '@/i18n'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

const strings = landingStrings(getTranslations('en'))

describe('Hero CTA', () => {
    it('renders the CTA without a scale custom property', () => {
        const { container } = render(
            <Hero strings={strings} locale="en" buttonVisible primaryCta={{ label: 'Sign up', href: '/setup' }} />
        )

        const cta = container.querySelector('.cta-motion') as HTMLElement | null
        expect(cta).not.toBeNull()
        expect(cta!.getAttribute('style')).not.toContain('--cta-scale')
        // the translate/rotate entrance stays
        expect(cta!.getAttribute('style')).toContain('--cta-x')
    })

    it('keeps rendering a custom CTA without a scale custom property', () => {
        const { container } = render(
            <Hero strings={strings} locale="en" buttonVisible customCta={<span>store pair</span>} />
        )

        const cta = container.querySelector('.cta-motion') as HTMLElement | null
        expect(cta).not.toBeNull()
        expect(cta!.getAttribute('style')).not.toContain('--cta-scale')
    })
})

describe('SendInSeconds fold', () => {
    // The scroll-jack regression guard. Keep it free of fold-10 content assertions.
    it('drops the scroll-jack target but keeps the section anchor and the CTA motion class', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        expect(container.querySelector('#send-in-seconds')).toBeInTheDocument()
        expect(container.querySelector('#sticky-button-target')).toBeNull()
        expect(container.querySelector('.cta-motion')).not.toBeNull()
    })

    // Fold 10's content as it ships today. PR 2 of TASK-21788 rewrites this fold into
    // "GET THE APP" and re-points the CTA away from /send, so this is the test to
    // retarget or delete there — the regression guard above stays untouched.
    it('links the CTA to /send with the entrance animation (fold-10 content, superseded by PR 2)', () => {
        const { container } = render(<SendInSeconds locale="en" />)

        expect(container.querySelector('.cta-motion.cta-enter')).not.toBeNull()
        expect(container.querySelector('a[href="/send"]')).toBeInTheDocument()
    })
})
