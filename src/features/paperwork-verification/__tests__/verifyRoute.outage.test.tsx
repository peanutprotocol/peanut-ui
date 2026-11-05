import { screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import VerifyRoute from '@/app/(mobile-ui)/verify/page'

let mockDown = true
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDown }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('../PaperworkVerificationFlow', () => ({ PaperworkVerificationFlow: () => <div>ordinary verification</div> }))
jest.mock('../IdentityRestartFlow', () => ({ IdentityRestartFlow: () => <div>replacement verification</div> }))
jest.mock('../AddFeatureFlow', () => ({ AddFeatureFlow: () => <div>feature verification</div> }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

it.each(['', '?feature=bank', '?step=id&restart=1'])(
    'outage blocks verification entry %s through the shared switch',
    (query) => {
        mockDown = true
        renderWithIntl(
            <NuqsTestingAdapter searchParams={query}>
                <VerifyRoute />
            </NuqsTestingAdapter>
        )
        expect(screen.getByTestId('verify-outage')).toBeInTheDocument()
        expect(screen.queryByText(/ordinary verification|replacement verification|feature verification/)).toBeNull()
    }
)
it('switch recovery restores the requested entry', () => {
    mockDown = false
    renderWithIntl(
        <NuqsTestingAdapter searchParams="?feature=local">
            <VerifyRoute />
        </NuqsTestingAdapter>
    )
    expect(screen.getByText('feature verification')).toBeInTheDocument()
})
