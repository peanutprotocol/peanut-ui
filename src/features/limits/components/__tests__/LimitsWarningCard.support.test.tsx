jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * The blocking card is an error Callout, and an error Callout adds its own
 * "Contact support" link when its text asks for support. The card already
 * renders "Need higher limits? Contact support." as its support action, so it
 * must mark that action — otherwise the user sees "Contact support" twice.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import LimitsWarningCard from '../LimitsWarningCard'

const mockOpenSupport = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) =>
        ({
            needHigherLimits: 'Need higher limits? Contact support.',
            contactSupport: 'Contact support',
        })[key] ?? key,
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => ({ openSupportWithMessage: mockOpenSupport }),
}))

jest.mock('@/features/limits/utils', () => ({
    LIMITS_COPY: { SUPPORT_MESSAGE: 'Hi, I would like to increase my payment limits.' },
}))

jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))

describe('LimitsWarningCard support action', () => {
    it('shows one "Contact support" on the blocking error card', () => {
        render(
            <LimitsWarningCard
                type="error"
                title="This amount exceeds the limit"
                items={[{ text: 'You can pay up to $500 today.' }]}
            />
        )

        expect(screen.getAllByText(/contact support/i)).toHaveLength(1)

        fireEvent.click(screen.getByText('Need higher limits? Contact support.'))
        expect(mockOpenSupport).toHaveBeenCalledWith('Hi, I would like to increase my payment limits.')
    })
})
