import { render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import VerifyRoute from '../page'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/features/verify-once/VerifyOnceFlow', () => ({ VerifyOnceFlow: () => <div>verify-once</div> }))
jest.mock('@/features/verify-once/AddFeatureFlow', () => ({
    AddFeatureFlow: ({ feature }: { feature: string }) => <div>add-{feature}</div>,
}))
jest.mock('@/features/verify-once/IdentityRestartFlow', () => ({
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
        ['?step=id', 'verify-once'],
        ['?feature=bank', 'add-bank'],
        ['?restart=yes', 'verify-once'],
    ])('%s opens %s', async (search, shown) => {
        renderAt(search)
        expect(await screen.findByText(shown)).toBeInTheDocument()
    })
})
