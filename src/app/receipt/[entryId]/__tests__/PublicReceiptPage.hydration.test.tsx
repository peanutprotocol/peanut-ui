import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { PublicReceiptPage } from '@/app/receipt/[entryId]/PublicReceiptPage'
import { useAuth } from '@/context/authContext'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <nav data-testid="receipt-nav">Receipt navigation</nav>,
}))
jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: ({ showPublicIssuer }: { showPublicIssuer: boolean }) => (
        <div data-testid="receipt" data-show-public-issuer={showPublicIssuer}>
            {showPublicIssuer && <span data-testid="public-issuer">Public issuer</span>}
        </div>
    ),
}))
jest.mock('@/components/TransactionDetails/ReceiptUnavailable', () => ({
    ReceiptUnavailable: () => <div data-testid="receipt-unavailable">Receipt unavailable</div>,
}))

const mockedUseAuth = jest.mocked(useAuth)
const transaction = { id: 'hydration-receipt' } as never

type AuthState = 'loading' | 'anonymous' | 'authenticated'

function Tree({ state, initialAuthState }: { state?: 'gone' | 'loadFailed'; initialAuthState?: AuthState }) {
    return (
        <IntlWrapper>
            <section>
                <PublicReceiptPage
                    state={state}
                    transaction={state ? undefined : transaction}
                    initialAuthState={initialAuthState}
                />
                <p data-testid="sentinel">Page content</p>
            </section>
        </IntlWrapper>
    )
}

describe('PublicReceiptPage authentication hydration', () => {
    let container: HTMLDivElement
    let root: Root | undefined

    beforeEach(() => {
        mockedUseAuth.mockReturnValue({ user: null, isFetchingUser: true } as ReturnType<typeof useAuth>)
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        jest.clearAllMocks()
    })

    it.each(['gone', 'loadFailed'] as const)(
        'hydrates an unresolved server session with cached client authentication for %s',
        async (state) => {
            container.innerHTML = renderToString(<Tree state={state} />)
            const sentinel = container.querySelector('[data-testid="sentinel"]')
            expect(container.querySelector('[data-testid="receipt-nav"]')).toBeNull()
            mockedUseAuth.mockReturnValue({
                user: { user: { userId: 'cached-user' } },
                isFetchingUser: false,
            } as ReturnType<typeof useAuth>)
            const onRecoverableError = jest.fn()

            await act(async () => {
                root = hydrateRoot(container, <Tree state={state} />, { onRecoverableError })
            })

            expect(onRecoverableError).not.toHaveBeenCalled()
            expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
            expect(container.querySelector('[data-testid="receipt-nav"]')).toBeInTheDocument()
            expect(container.querySelector('[data-testid="receipt-unavailable"]')).toBeInTheDocument()
        }
    )

    it('hydrates an unresolved server session as anonymous and then shows the public issuer', async () => {
        container.innerHTML = renderToString(<Tree />)
        const sentinel = container.querySelector('[data-testid="sentinel"]')
        expect(container.querySelector('[data-testid="receipt-nav"]')).toBeNull()
        expect(container.querySelector('[data-testid="public-issuer"]')).toBeNull()
        mockedUseAuth.mockReturnValue({ user: null, isFetchingUser: false } as ReturnType<typeof useAuth>)
        const onRecoverableError = jest.fn()

        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })

        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
        expect(container.querySelector('[data-testid="receipt-nav"]')).toBeNull()
        expect(container.querySelector('[data-testid="receipt"]')).toHaveAttribute('data-show-public-issuer', 'true')
        expect(container.querySelector('[data-testid="public-issuer"]')).toBeInTheDocument()
    })

    it.each(
        (['loading', 'anonymous', 'authenticated'] as const).flatMap((serverState) =>
            (['loading', 'anonymous', 'authenticated'] as const).map((clientState) => [serverState, clientState])
        )
    )('preserves serialized %s SSR output when the live client session is %s', async (serverState, clientState) => {
        const auth = (state: AuthState) =>
            ({
                user: state === 'authenticated' ? { user: { userId: 'cached-user' } } : null,
                isFetchingUser: state === 'loading',
            }) as ReturnType<typeof useAuth>
        mockedUseAuth.mockReturnValue(auth(serverState))
        // Known server state is serialized with the page, independently of browser query-cache state.
        const initialAuthState = serverState === 'loading' ? undefined : serverState
        container.innerHTML = renderToString(<Tree initialAuthState={initialAuthState} />)
        const receipt = container.querySelector('[data-testid="receipt"]')
        const issuer = container.querySelector('[data-testid="public-issuer"]')
        const sentinel = container.querySelector('[data-testid="sentinel"]')
        expect(Boolean(container.querySelector('[data-testid="receipt-nav"]'))).toBe(serverState === 'authenticated')
        expect(Boolean(issuer)).toBe(serverState === 'anonymous')
        mockedUseAuth.mockReturnValue(auth(clientState))
        const onRecoverableError = jest.fn()

        await act(async () => {
            root = hydrateRoot(container, <Tree initialAuthState={initialAuthState} />, { onRecoverableError })
        })

        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="receipt"]')).toBe(receipt)
        expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
        expect(Boolean(container.querySelector('[data-testid="receipt-nav"]'))).toBe(clientState === 'authenticated')
        expect(Boolean(container.querySelector('[data-testid="public-issuer"]'))).toBe(clientState === 'anonymous')
        if (serverState === 'anonymous' && clientState === 'anonymous') {
            expect(container.querySelector('[data-testid="public-issuer"]')).toBe(issuer)
        }
    })
})
