import { render } from '@testing-library/react'
import { getTranslations } from '@/i18n'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { HomeFolds } from '../HomeFolds'
import { landingStrings } from '../landingStrings'

let cardFoldDisabled = false

jest.mock('@/hooks/useFeatureFlag', () => ({
    useFeatureFlags: () => () => cardFoldDisabled,
}))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
// No AuthProvider mock: the home renders with none above it, as these folds must survive.
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => () => false }))
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => false }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} />,
}))

const FAQ_ITEMS = [
    { id: 'who-can-pay', question: 'Who can pay me?', answer: 'Employers and business clients.' },
    { id: 'cost', question: 'What does it cost?', answer: 'No Peanut fee to open or keep your accounts.' },
]

function renderHome(locale: Locale = 'en') {
    return render(
        <HomeFolds
            locale={locale}
            strings={landingStrings(getTranslations(locale))}
            faqItems={FAQ_ITEMS}
            closeCta={{ label: 'Sign up', href: '/setup' }}
        />
    )
}

const foldIds = (container: HTMLElement) => Array.from(container.querySelectorAll('section[id]'), (s) => s.id)

describe('HomeFolds', () => {
    beforeEach(() => {
        cardFoldDisabled = false
    })

    it('renders the folds in the c1-v3 order', () => {
        const { container } = renderHome()
        expect(foldIds(container)).toEqual([
            'home-get-paid',
            'home-request',
            'home-balance',
            'peanut-card',
            'home-pay-local',
            'faq',
            'home-close',
        ])
    })

    it('has the two tickers of the design: card/QR under the card fold, passkey over the trust band', () => {
        const { container } = renderHome()
        const tickers = container.querySelectorAll('.star-lp-marquee')
        expect(tickers).toHaveLength(2)
        expect(tickers[0].previousElementSibling?.id).toBe('peanut-card')
        expect(tickers[1].previousElementSibling?.id).toBe('home-pay-local')
    })

    it('drops the card fold and its ticker when the kill switch is on', () => {
        cardFoldDisabled = true
        const { container } = renderHome()
        expect(container.querySelector('#peanut-card')).toBeNull()
        expect(container.querySelectorAll('.star-lp-marquee')).toHaveLength(1)
        expect(foldIds(container)).toContain('home-pay-local')
    })

    it('emits one FAQPage JSON-LD, from the FAQ fold', () => {
        const { container } = renderHome()
        const schemas = Array.from(container.querySelectorAll('script[type="application/ld+json"]'), (s) =>
            JSON.parse(s.textContent ?? '{}')
        ).filter((schema) => schema['@type'] === 'FAQPage')
        expect(schemas).toHaveLength(1)
        expect(schemas[0].mainEntity).toHaveLength(FAQ_ITEMS.length)
    })

    it('repeats the hero CTA in the close', () => {
        const { container } = renderHome()
        const close = container.querySelector('#home-close a')
        expect(close).toHaveTextContent('Sign up')
        expect(close).toHaveAttribute('href', '/setup')
    })

    it.each(SUPPORTED_LOCALES)('%s renders with every string filled', (locale) => {
        const { container } = renderHome(locale)
        const text = container.textContent ?? ''
        expect(text).not.toMatch(/undefined|\{(username|main|payer|amount|argentina|brazil)\}/)
        const labels = Array.from(container.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label'))
        for (const label of labels) expect(label).not.toMatch(/undefined|\{\w+\}/)
    })
})
