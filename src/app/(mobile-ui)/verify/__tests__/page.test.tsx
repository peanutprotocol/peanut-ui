import { fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import { IntlWrapper } from '@/test-utils/intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import VerifyRoute from '../page'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
let mockDegraded = false
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDegraded }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/paperwork-verification/PaperworkVerificationFlow', () => ({
    PaperworkVerificationFlow: () => <div>paperwork-verification</div>,
}))
jest.mock('@/features/paperwork-verification/AddFeatureFlow', () => ({
    AddFeatureFlow: ({ feature }: { feature: string }) => <div>add-{feature}</div>,
}))
jest.mock('@/features/paperwork-verification/IdentityRestartFlow', () => ({
    IdentityRestartFlow: () => <div>identity-restart</div>,
}))

const renderAt = (search: string) =>
    render(
        <IntlWrapper>
            <NuqsTestingAdapter searchParams={search}>
                <VerifyRoute />
            </NuqsTestingAdapter>
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockDegraded = false
})

describe('/verify', () => {
    it.each([
        ['?step=id&restart=1', 'identity-restart'],
        ['?step=id', 'paperwork-verification'],
        ['?feature=bank', 'add-bank'],
        ['?restart=yes', 'paperwork-verification'],
    ])('%s opens %s', async (search, shown) => {
        renderAt(search)
        expect(await screen.findByText(shown)).toBeInTheDocument()
    })
})

describe('/verify during a verification outage', () => {
    it.each([
        ['?step=id', { flow: 'paperwork_verification', residence: null }],
        ['?feature=card', { flow: 'add_later', residence: null, feature: 'card' }],
        ['?step=id&restart=1', { flow: 'paperwork_verification', residence: null, restart: true }],
    ])('%s reports the outage controls as the flow it would have opened', async (search, flow) => {
        mockDegraded = true
        renderAt(search)
        fireEvent.click(await screen.findByTestId('verify-back'))
        fireEvent.click(screen.getByRole('button', { name: /notify me/i }))
        const controls = jest
            .mocked(posthog.capture)
            .mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
            .map(([, props]) => props)
        expect(controls).toEqual([
            { ...flow, screen_id: 'outage', control: 'back', action: 'tap' },
            { ...flow, screen_id: 'outage', control: 'notify_me', action: 'tap' },
        ])
    })
})
