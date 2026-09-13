/**
 * The blocking Add Money card is rendered for both Manteca currencies. These
 * tests keep the native route failure visible and prove the pointer-events
 * diagnostic captures the state on both sides of the attempted push.
 */
/** @jest-environment jsdom */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LimitsWarningCard from '../LimitsWarningCard'

const mockPush = jest.fn()
const mockCapture = jest.fn()
var native = true

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-intl', () => ({
    useTranslations: (namespace: string) => (key: string) => {
        const copy: Record<string, string> = {
            'limits.warningCard.checkLimits': 'Check my limits.',
            'common.genericError': 'Something went wrong. Please try again or contact support.',
            'common.tryAgain': 'Try again',
        }
        return copy[`${namespace}.${key}`] ?? key
    },
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: jest.fn() }),
}))

jest.mock('@/features/limits/utils', () => ({
    LIMITS_COPY: {
        SUPPORT_MESSAGE: 'Hi, I would like to increase my payment limits.',
    },
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => native,
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { LIMITS_CHECK_LINK_NAVIGATION: 'limits_check_link_navigation' },
}))

jest.mock('@/components/0_Bruddle/Notification', () => ({
    Notification: ({ children, title }: { children: React.ReactNode; title: string }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
}))

jest.mock('@/components/0_Bruddle/BulletList', () => ({
    BulletList: ({ items }: { items: React.ReactNode[] }) => (
        <ul>
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    ),
}))

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: () => null,
}))

const renderBlockingCard = (currency: 'ARS' | 'BRL') =>
    render(
        <LimitsWarningCard
            type="error"
            title="This amount exceeds your limit."
            items={[
                {
                    text: 'Check my limits.',
                    isLink: true,
                    href: '/limits',
                    kind: 'check-limits',
                },
            ]}
            flowType="onramp"
            currency={currency}
            showSupportLink={false}
        />
    )

describe('LimitsWarningCard native navigation', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        native = true
        document.body.style.pointerEvents = 'none'
    })

    afterEach(() => {
        jest.useRealTimers()
        document.body.style.pointerEvents = ''
    })

    test.each(['ARS', 'BRL'] as const)(
        'records native %s navigation state and offers recovery when push is swallowed',
        (currency) => {
            mockPush.mockImplementation(() => {
                document.body.style.pointerEvents = 'auto'
            })
            renderBlockingCard(currency)

            fireEvent.click(screen.getByRole('button', { name: 'Check my limits.' }))
            expect(mockPush).toHaveBeenCalledWith('/limits')
            expect(mockCapture).toHaveBeenNthCalledWith(
                1,
                'limits_check_link_navigation',
                expect.objectContaining({
                    currency,
                    native: true,
                    outcome: 'attempted',
                    pointer_events_before: 'none',
                })
            )

            act(() => jest.advanceTimersByTime(1500))

            expect(mockCapture).toHaveBeenLastCalledWith(
                'limits_check_link_navigation',
                expect.objectContaining({
                    currency,
                    outcome: 'failed',
                    pointer_events_after: 'auto',
                    pointer_events_changed: true,
                })
            )
            expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
            expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        }
    )

    test('records completion when the route reaches /limits', () => {
        mockPush.mockImplementation(() => window.history.pushState({}, '', '/limits'))
        renderBlockingCard('ARS')

        fireEvent.click(screen.getByRole('button', { name: 'Check my limits.' }))
        act(() => jest.advanceTimersByTime(1500))

        expect(mockCapture).toHaveBeenLastCalledWith(
            'limits_check_link_navigation',
            expect.objectContaining({ outcome: 'completed', pointer_events_after: 'none' })
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
