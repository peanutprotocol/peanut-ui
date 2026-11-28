import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycFeatureActivationStatus } from '@/features/paperwork-verification/KycFeatureActivationStatus'
import type { FeatureReportEntry } from '@/types/capabilities'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/verify',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/features/paperwork-verification/analytics', () => ({
    useKycControl: () => ({ track: jest.fn() }),
}))
jest.mock('@/features/paperwork-verification/FeatureAction', () => ({
    FeatureAction: ({ action }: { action: string }) => <div data-testid="feature-action">{action}</div>,
}))
jest.mock('@/features/paperwork-verification/ReplacementDocumentAction', () => ({
    ReplacementDocumentAction: () => <div data-testid="replacement-doc-action" />,
}))
jest.mock('@/features/paperwork-verification/components/StatusScreens', () => ({
    FeatureReadyScreen: ({ feature }: { feature: string }) => <div data-testid="feature-ready">{feature}</div>,
    FeatureSettingUpScreen: ({ currency }: { currency: string }) => (
        <div data-testid="feature-setting-up">{currency}</div>
    ),
}))

describe('KycFeatureActivationStatus state simulation (no false ready screen)', () => {
    it.each([
        ['non-supplement action_required (questions)', { state: 'action_required', action: 'questions' }],
        ['non-supplement action_required (contact-support)', { state: 'action_required', action: 'contact-support' }],
        ['action_required with no action', { state: 'action_required' }],
        ['unknown future state', { state: 'unexpected_future_state' as FeatureReportEntry['state'] }],
    ] as const)('never renders FeatureReadyScreen for %s', (_label, entry) => {
        renderWithIntl(
            <KycFeatureActivationStatus
                feature="bank"
                result={null}
                accountStatus={entry as FeatureReportEntry}
                isLoading={false}
                onRetry={jest.fn()}
                onBack={jest.fn()}
            />
        )
        expect(screen.queryByTestId('feature-ready')).toBeNull()
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })

    it('still renders FeatureAction for supplement:* actions', () => {
        renderWithIntl(
            <KycFeatureActivationStatus
                feature="bank"
                result={null}
                accountStatus={{ state: 'action_required', action: 'supplement:poa' }}
                isLoading={false}
                onRetry={jest.fn()}
                onBack={jest.fn()}
            />
        )
        expect(screen.getByTestId('feature-action')).toHaveTextContent('supplement:poa')
    })

    it('renders FeatureReadyScreen when state is on, pending, or setting_up', () => {
        for (const state of ['on', 'pending', 'setting_up'] as const) {
            const { unmount } = renderWithIntl(
                <KycFeatureActivationStatus
                    feature="bank"
                    result={null}
                    accountStatus={{ state }}
                    isLoading={false}
                    onRetry={jest.fn()}
                    onBack={jest.fn()}
                />
            )
            expect(screen.getByTestId('feature-ready')).toHaveTextContent('bank')
            unmount()
        }
    })
})
