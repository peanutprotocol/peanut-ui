/**
 * Regression guard for the deleted "Send in seconds" scroll-jack: the landing
 * page used to freeze `document.body` and swallow wheel/touch events while it
 * grew the CTA. Nothing may bring that back.
 */
import { render, screen } from '@testing-library/react'
import { act, type ReactNode } from 'react'
import type { LandingStrings } from '../landingStrings'
import type { LandingContentHrefs } from '../landingContentHrefs'

const heroProps: Record<string, unknown>[] = []

jest.mock('next/dynamic', () => ({
    __esModule: true,
    default: () => () => null,
}))

jest.mock('@/context/footerVisibility', () => ({
    useFooterVisibility: () => ({ isFooterVisible: false }),
}))

jest.mock('next-intl', () => ({
    useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

jest.mock('@/hooks/useMigrationFlag', () => ({
    useMigrationFlag: () => false,
}))

jest.mock('@/hooks/useGetDeviceType', () => ({
    ...jest.requireActual('@/hooks/useGetDeviceType'),
    useDeviceType: () => ({ deviceType: 'web' }),
}))

jest.mock('@/utils/migration.utils', () => ({
    storeAnchorHref: () => 'https://example.test/store',
    onStoreAnchorClick: jest.fn(),
}))

jest.mock('@/components/Migration/StorePair', () => ({
    __esModule: true,
    default: () => <div data-testid="store-pair" />,
}))

jest.mock('../hero', () => ({
    Hero: (props: Record<string, unknown>) => {
        heroProps.push(props)
        return <section id="hero" />
    },
}))

jest.mock('../marquee', () => ({ Marquee: () => <div data-testid="marquee" /> }))
jest.mock('../noFees', () => ({ NoFees: () => <div data-testid="no-fees" /> }))
jest.mock('../ShhhhhFold', () => ({ ShhhhhFold: () => <div data-testid="door" /> }))
jest.mock('../StickyMobileCTA', () => ({ StickyMobileCTA: () => <div data-testid="sticky" /> }))

// imported after the mocks so the component picks them up
import { LandingPageClient } from '../LandingPageClient'

// window.innerHeight is 768 in jsdom: the old handler froze the page while the
// target's top was <= 692 and its bottom >= 640.
const armFreezeWindow = (node: HTMLDivElement | null) => {
    if (!node) return
    node.getBoundingClientRect = () => ({ top: 600, bottom: 660, height: 60 }) as DOMRect
}

/**
 * jsdom gives every element a zero rect, so the deleted freeze window could
 * never open by accident. This puts a `#sticky-button-target` back on screen,
 * parked exactly where the old handler used to freeze the page — the fixture
 * that makes this suite fail against the pre-deletion component.
 */
const legacyTarget = () => (
    <section id="send-in-seconds">
        <div id="sticky-button-target" ref={armFreezeWindow}>
            cta
        </div>
    </section>
)

const renderLanding = (sendInSecondsSlot: ReactNode = <section id="send-in-seconds" />) =>
    render(
        <LandingPageClient
            heroConfig={{ primaryCta: { label: 'Sign up', href: '/setup' } }}
            marqueeMessages={['GLOBAL']}
            locale="en"
            strings={{} as LandingStrings}
            contentHrefs={{} as LandingContentHrefs}
            problemSlot={<div />}
            mantecaSlot={<div />}
            regulatedRailsSlot={<div />}
            yourMoneySlot={<div />}
            securitySlot={<div />}
            sendInSecondsSlot={sendInSecondsSlot}
            footerSlot={<div />}
            faqSlot={<div />}
        />
    )

describe('LandingPageClient — no scroll-jack', () => {
    beforeEach(() => {
        heroProps.length = 0
        document.body.style.overflow = ''
    })

    it('never freezes body scroll, however far the page is scrolled', () => {
        renderLanding(legacyTarget())

        for (const y of [0, 400, 1200, 4000]) {
            act(() => {
                window.scrollY = y
                window.dispatchEvent(new Event('scroll'))
            })
            expect(document.body.style.overflow).toBe('')
        }
    })

    it('does not preventDefault wheel or touchmove events', () => {
        renderLanding(legacyTarget())

        act(() => {
            window.scrollY = 1200
            window.dispatchEvent(new Event('scroll'))
        })

        const wheel = Object.assign(new Event('wheel', { bubbles: true, cancelable: true }), { deltaY: 400 })
        const touchStart = Object.assign(new Event('touchstart', { bubbles: true, cancelable: true }), {
            touches: [{ clientY: 500 }],
        })
        const touchMove = Object.assign(new Event('touchmove', { bubbles: true, cancelable: true }), {
            touches: [{ clientY: 100 }],
        })
        act(() => {
            window.dispatchEvent(wheel)
            window.dispatchEvent(touchStart)
            window.dispatchEvent(touchMove)
        })

        expect(wheel.defaultPrevented).toBe(false)
        expect(touchMove.defaultPrevented).toBe(false)
    })

    it('does not hand the hero a buttonScale', () => {
        renderLanding()

        expect(heroProps.length).toBeGreaterThan(0)
        for (const props of heroProps) {
            expect(props).not.toHaveProperty('buttonScale')
        }
    })

    it('renders the send-in-seconds slot with no wrapper element around it', () => {
        const { container } = renderLanding(<section id="send-in-seconds" data-testid="send-in-seconds" />)

        // The deleted wrapper was `<div ref={sendInSecondsRef}>{sendInSecondsSlot}</div>`, which
        // carried no id or class — the only thing that catches it coming back is the slot's
        // parent. LandingPageClient returns a fragment, so the slot must be a direct child of
        // the render container; pre-deletion it was a child of that anonymous div.
        expect(screen.getByTestId('send-in-seconds').parentElement).toBe(container)
    })
})
