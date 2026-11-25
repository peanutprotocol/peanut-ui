/**
 * The card add-money drawer fixtures (TASK-25169) reach the state they name: each fixture's own
 * `/users/me` and `/users/deposit-accounts` answers run through the real `useAddMoneyReadiness` and
 * `cardBankPlan`, and the crypto fixtures answer the deposit and balance they promise.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { formatUnits } from 'viem'
import type { ReactNode } from 'react'
import { FIXTURES } from '@/dev/fixtures/registry'
import { fixtureRespond } from '@/dev/fixtures/respond'
import { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import { cardBankPlan, cardCryptoAskUsd, cardGapUsd, type CardBankPlan } from '@/features/card/cardAddMoney'
import { DEMO_ADDRESS } from '@/constants/demo-data'
import { getDemoBalanceUnits } from '@/utils/demo-balance'

let mockAuthUser: { user?: { userId?: string } } | null = null

jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUser, userId: mockAuthUser?.user?.userId, isFetchingUser: false }),
}))
jest.mock('@/utils/native-platform', () => ({ useHydrationSnapshot: () => null }))
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, options?: RequestInit) =>
        jest.requireActual('@/dev/fixtures/respond').fixtureRespond(path, options),
}))

class TestResponse {
    status: number
    constructor(
        private body: unknown,
        init?: { status?: number }
    ) {
        this.status = init?.status ?? 200
    }
    headers = { get: () => 'application/json' }
    get ok() {
        return this.status >= 200 && this.status < 300
    }
    json() {
        return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body)
    }
    static json(body: unknown, init?: { status?: number }) {
        return new TestResponse(body, init)
    }
}

const originalResponse = global.Response
beforeAll(() => {
    global.Response = TestResponse as unknown as typeof Response
})
afterAll(() => {
    global.Response = originalResponse
})
afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
})

function activate(name: string) {
    window.history.replaceState({}, '', `${FIXTURES[name].route}&__fixture=${name}`)
    window.sessionStorage.setItem('peanut_fixture', name)
}

const read = async (path: string, method = 'GET') => (await fixtureRespond(path, { method })).json()

async function bankPlanOf(name: string): Promise<CardBankPlan> {
    activate(name)
    mockAuthUser = await read('/users/me')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useAddMoneyReadiness(true), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    return cardBankPlan(result.current)
}

const spendableUsd = () => Number(formatUnits(getDemoBalanceUnits(), 6))

describe('card add-money drawer fixtures', () => {
    const names = Object.keys(FIXTURES).filter((name) => name.startsWith('card-add-money-'))

    it('all open the funding step with no card collateral in the balance', () => {
        expect(names.length).toBe(12)
        for (const name of names) {
            expect(FIXTURES[name].route).toBe('/card?card_step=funding')
            expect((FIXTURES[name].responses?.['GET /rain/cards'] as { balance: unknown }).balance).toBeNull()
        }
    })

    it.each([
        ['card-add-money-crypto', { kind: 'rows', rows: [{ kind: 'page', corridor: 'ACH_US' }] }],
        ['card-add-money-bank-one', { kind: 'rows', rows: [{ kind: 'account', corridor: 'ACH_US' }] }],
        [
            'card-add-money-bank-two',
            {
                kind: 'rows',
                rows: [
                    { kind: 'account', corridor: 'SEPA_EU' },
                    { kind: 'account', corridor: 'ACH_US' },
                ],
            },
        ],
        ['card-add-money-bank-ars', { kind: 'rows', rows: [{ kind: 'page', corridor: 'BANK_TRANSFER_AR' }] }],
        ['card-add-money-bank-setting-up', { kind: 'setting-up', corridor: 'BANK_TRANSFER_AR' }],
        ['card-add-money-not-verified', { kind: 'not-verified' }],
        ['card-add-money-under-review', { kind: 'under-review' }],
        ['card-add-money-bank-not-offered', { kind: 'not-offered' }],
    ])('%s: the bank view is %j', async (name, expected) => {
        expect(await bankPlanOf(name)).toEqual(expected)
    })

    it.each([
        ['card-add-money-crypto', 3.2, 6.8, { askUsd: 10, raisedToMinimum: true }],
        ['card-add-money-crypto-min', 3.2, 6.8, { askUsd: 10, raisedToMinimum: true }],
        ['card-add-money-crypto-gap-above-min', 0, 10, { askUsd: 10, raisedToMinimum: false }],
    ])('%s: $%s spendable, a $%s gap, and the ask %j', async (name, balance, gap, ask) => {
        activate(name)
        const deposit = await read('/rhino/deposit', 'POST')
        expect(deposit.depositAddress).toBe(DEMO_ADDRESS)
        expect(spendableUsd()).toBe(balance)
        expect(cardGapUsd(spendableUsd())).toBe(gap)
        expect(cardCryptoAskUsd(gap, deposit.minDepositLimitUsd)).toEqual(ask)
    })

    it.each([
        ['card-add-money-crypto-short', 4, 7.2],
        ['card-add-money-funded', 10, 13.2],
    ])('%s: the deposit lands as $%s and the balance then reads $%s', async (name, amount, after) => {
        activate(name)
        await read('/users/me')
        expect(spendableUsd()).toBe(3.2)
        // the read at open sees nothing sent yet, so the drawer shows the address first
        expect(await read(`/rhino/status/${DEMO_ADDRESS}`)).toEqual({ status: 'not_started' })
        // then it is on its way, so the processing view shows
        expect(await read(`/rhino/status/${DEMO_ADDRESS}`)).toEqual({ status: 'pending' })
        expect(spendableUsd()).toBe(3.2)
        expect(await read(`/rhino/status/${DEMO_ADDRESS}`)).toEqual({ status: 'completed', amount })
        expect(spendableUsd()).toBe(after)
        // and it stays credited on every later answer
        await read('/users/me')
        expect(spendableUsd()).toBe(after)
        expect((await fixtureRespond(`/rhino/reset-status/${DEMO_ADDRESS}`, { method: 'POST' })).status).toBe(500)
    })

    it('with nothing sent, the status reads not_started and the balance stays as it was', async () => {
        activate('card-add-money-crypto')
        expect(await read(`/rhino/status/${DEMO_ADDRESS}`)).toEqual({ status: 'not_started' })
        expect(spendableUsd()).toBe(3.2)
    })
})
