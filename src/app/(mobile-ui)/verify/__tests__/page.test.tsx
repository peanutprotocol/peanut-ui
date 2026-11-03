import { render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import VerifyRoute from '../page'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
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
        <NuqsTestingAdapter searchParams={search}>
            <VerifyRoute />
        </NuqsTestingAdapter>
    )

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
