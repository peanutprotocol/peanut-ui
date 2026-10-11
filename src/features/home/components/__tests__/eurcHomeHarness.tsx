/**
 * Shared harness for the EURC home acceptance suites.
 *
 * The suites drive the real CurrencyAccountsHome -> EurcAccountView ->
 * review/progress tree. Only the I/O edges are faked: `apiFetch` (the one HTTP
 * layer, answered by the in-memory `server` below, honouring abort signals),
 * the passkey ceremony (`passkey.sign`) and the Base RPC balance read. Each
 * suite registers those mocks with jest.mock and points them here.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { randomUUID } from 'node:crypto'
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem'
import type { CurrencyOperation } from '@/services/currency-accounts'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'
import { CurrencyAccountsHome } from '../CurrencyAccountsHome'

if (!globalThis.crypto.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID, configurable: true })
}

export const WALLET = `0x${'12'.repeat(20)}` as `0x${string}`
export const RECIPIENT = `0x${'22'.repeat(20)}` as `0x${string}`
export const BRIDGE_DEPOSIT = `0x${'33'.repeat(20)}` as `0x${string}`

export const EURC_ACCOUNT = { ...EURC_ASSET, id: 'eurc-1', address: WALLET, isDefault: false }
const USDC_ACCOUNT = {
    asset: 'USDC',
    currency: 'USD',
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    decimals: 6,
    id: 'usdc-1',
    address: WALLET,
    isDefault: true,
}

export const SEPA_INSTRUCTIONS = {
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    bank_beneficiary_name: 'Bridge Ventures',
    deposit_message: 'BRGREF123',
    currency: 'EUR',
}

type ServerOperation = CurrencyOperation & { owner: string }
export type HistoryPage = {
    entries: Array<Record<string, unknown>>
    operations: CurrencyOperation[]
    cursor?: string | null
    hasMore?: boolean
}
export type FakeRequest = { method: string; path: string; body: unknown; signal: AbortSignal | null }
type Reply = { status: number; body: unknown } | Error
type Handler = (request: FakeRequest) => Reply | Promise<Reply> | undefined

/** A deterministic, recognisable signature per ceremony: ceremony n signs nonce n. */
export const signatureFor = (ceremony: number) => `0x${ceremony.toString(16).padStart(2, '0').repeat(65)}`

export const passkey = {
    /** Override to defer or fail a ceremony. Receives the 1-based ceremony number. */
    behaviour: undefined as undefined | ((ceremony: number) => Promise<void>),
    sign: jest.fn(
        async (
            calls: Array<{ to: string; data: `0x${string}`; value: bigint }>,
            _chainId: string
        ): Promise<{ signedUserOp: Record<string, unknown> }> => {
            const ceremony: number = passkey.sign.mock.calls.length
            await passkey.behaviour?.(ceremony)
            return {
                signedUserOp: {
                    sender: WALLET,
                    nonce: BigInt(ceremony),
                    callData: calls[0].data,
                    signature: signatureFor(ceremony) as `0x${string}`,
                },
            }
        }
    ),
}

export const server = {
    user: 'alice',
    ops: new Map<string, ServerOperation>(),
    /** History pages keyed by the `cursor` query value ('' for the first page). */
    historyPages: new Map<string, HistoryPage>(),
    requests: [] as FakeRequest[],
    handlers: [] as Handler[],
    reset() {
        this.user = 'alice'
        this.ops.clear()
        this.historyPages.clear()
        this.requests = []
        this.handlers = []
    },
    put(op: CurrencyOperation, owner = 'alice') {
        this.ops.set(op.id, { ...op, owner })
    },
    get(id: string): CurrencyOperation {
        const { owner: _owner, ...op } = this.ops.get(id)!
        return op
    },
    patch(id: string, change: Partial<CurrencyOperation>) {
        this.ops.set(id, { ...this.ops.get(id)!, ...change })
    },
    /** Every request whose method matches and whose path (with query) matches the pattern. */
    calls(method: string, pattern: RegExp) {
        return this.requests.filter((request) => request.method === method && pattern.test(request.path))
    },
}

const PREFIX = '/users/currency-accounts/EURC/'
const json = (status: number, body: unknown): Reply => ({ status, body })
const fail = (status: number, code: string): Reply => json(status, { error: code, code })

function view(op: ServerOperation): CurrencyOperation {
    const { owner: _owner, ...rest } = op
    return rest
}

function defaultRoute({ method, path, body }: FakeRequest): Reply {
    const [pathname, query = ''] = path.split('?')
    if (pathname === '/users/currency-accounts' && method === 'GET')
        return json(200, { accounts: [USDC_ACCOUNT, EURC_ACCOUNT], available: [] })
    if (!pathname.startsWith(PREFIX)) return fail(404, 'not_found')
    const rest = pathname.slice(PREFIX.length)
    if (rest === 'capabilities' && method === 'GET')
        return json(200, { receive: true, send: true, exchange: true, bankDeposit: true, bankWithdraw: true })
    if (rest === 'history' && method === 'GET') {
        const cursor = new URLSearchParams(query).get('cursor') ?? ''
        const page = server.historyPages.get(cursor)
        if (page) return json(200, page)
        if (cursor) return fail(400, 'invalid_cursor')
        const operations = [...server.ops.values()].filter((op) => op.owner === server.user).map(view)
        return json(200, { entries: [], operations, cursor: null, hasMore: false })
    }
    if (rest === 'bank-accounts' && method === 'GET')
        return json(200, { accounts: [{ id: 'bank-1', label: 'Euro bank' }] })
    if (rest === 'exchange-rate' && method === 'GET')
        return json(200, {
            midmarket_rate: '1.1',
            buy_rate: '1.11',
            sell_rate: '1.09',
            updated_at: new Date().toISOString(),
            indicative: true,
            developerFeePercent: '0',
        })
    if (rest === 'operations' && method === 'POST') {
        const input = body as {
            requestKey: string
            kind: CurrencyOperation['kind']
            amount: string
            recipient?: string
        }
        const op = makeOperation({
            id: input.requestKey,
            kind: input.kind,
            amount: input.amount,
            status: input.kind === 'BANK_DEPOSIT' ? 'AWAITING_FUNDS' : 'READY',
            to: (input.recipient as `0x${string}`) ?? BRIDGE_DEPOSIT,
        })
        server.put(op, server.user)
        return json(200, op)
    }
    const match = rest.match(/^operations\/([^/]+)(?:\/(submit|resume))?$/)
    if (!match) return fail(404, 'not_found')
    const id = decodeURIComponent(match[1])
    const op = server.ops.get(id)
    if (!op || op.owner !== server.user) return fail(404, 'operation_not_found')
    if (!match[2] && method === 'GET') return json(200, view(op))
    if (match[2] === 'submit' && method === 'POST') {
        if (op.status !== 'READY' && op.status !== 'SUBMITTED') return fail(409, 'operation_not_ready')
        server.patch(id, { status: 'SUBMITTED', userOpHash: `0x${'cd'.repeat(32)}` })
        return json(200, server.get(id))
    }
    if (match[2] === 'resume' && method === 'POST') return json(200, view(op))
    if (!match[2] && method === 'DELETE') {
        if (op.status === 'CANCELLED') return json(200, view(op))
        if (!['READY', 'AWAITING_FUNDS'].includes(op.status) || op.userOpHash)
            return fail(409, 'operation_already_submitted')
        server.patch(id, { status: 'CANCELLED' })
        return json(200, server.get(id))
    }
    return fail(404, 'not_found')
}

function abortable<T>(work: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
    if (!signal) return work
    const aborted = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    if (signal.aborted) return Promise.reject(aborted())
    return new Promise<T>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(aborted()), { once: true })
        work.then(resolve, reject)
    })
}

/** Stand-in for `apiFetch`: records the request, then answers from `server`. */
export async function fakeApiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const method = (options.method ?? 'GET').toUpperCase()
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined
    const request: FakeRequest = { method, path, body, signal: options.signal ?? null }
    server.requests.push(request)
    const reply = await abortable(
        (async () => {
            for (const handler of server.handlers) {
                const custom = await handler(request)
                if (custom !== undefined) return custom
            }
            return defaultRoute(request)
        })(),
        options.signal
    )
    if (reply instanceof Error) throw reply
    return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        headers: { get: () => null },
        json: async () => reply.body,
        text: async () => JSON.stringify(reply.body),
    } as unknown as Response
}

/** A browser network failure: the request may or may not have reached the server. */
export const lostResponse = () => new TypeError('Failed to fetch')

export function makeOperation({
    id = randomUUID(),
    kind = 'SEND',
    amount = '12.34',
    status = 'READY',
    to = RECIPIENT,
    userOpHash = null,
}: {
    id?: string
    kind?: CurrencyOperation['kind']
    amount?: string
    status?: string
    to?: `0x${string}`
    userOpHash?: string | null
} = {}): CurrencyOperation {
    return {
        id,
        kind,
        sourceAsset: 'EURC',
        amount,
        status,
        userOpHash,
        txHash: null,
        errorCode: null,
        externalAccountId: kind === 'BANK_WITHDRAW' ? 'bank-1' : null,
        destinationCurrency: kind === 'EXCHANGE' ? 'USD' : 'EUR',
        receipt: null,
        bankInstructions: kind === 'BANK_DEPOSIT' ? { ...SEPA_INSTRUCTIONS, amount } : null,
        call:
            kind === 'BANK_DEPOSIT'
                ? null
                : {
                      chainId: EURC_ASSET.chainId,
                      to: EURC_ASSET.tokenAddress,
                      value: '0',
                      data: encodeFunctionData({
                          abi: erc20Abi,
                          functionName: 'transfer',
                          args: [to, parseUnits(amount, 6)],
                      }),
                  },
    }
}

export const newQueryClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

/**
 * Renders the EURC home the way the app does, behind the nuqs testing adapter
 * (with memory, so URL writes are read back like a real router). `search` is
 * also mirrored into window.location for code that reads it directly.
 */
export function renderHome(search = '') {
    const urls: string[] = []
    const client = newQueryClient()
    window.history.replaceState({}, '', `/home${search}`)
    const tree = () => (
        <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={(event) => urls.push(event.queryString)}>
            <QueryClientProvider client={client}>
                <CurrencyAccountsHome
                    balanceProps={{
                        balance: 10_000_000n,
                        isFetching: false,
                        isHidden: false,
                        onToggleVisibility: () => {},
                    }}
                >
                    <div>USDC history and card</div>
                </CurrencyAccountsHome>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    )
    const result = render(tree())
    return {
        ...result,
        client,
        urls,
        currentSearch: () => urls.at(-1) ?? search,
        /** Same page, fresh element: hooks re-read their (mocked) context, e.g. a login change. */
        rerenderHome: () => result.rerender(tree()),
    }
}

export type RenderedHome = ReturnType<typeof renderHome>

/**
 * A page reload: React state, the query cache and module-level memory of the
 * rendered tree are gone; the URL, localStorage and the server survive.
 */
export function reload(previous: RenderedHome) {
    const search = previous.currentSearch()
    previous.unmount()
    previous.client.clear()
    return renderHome(search)
}

export async function selectEurc() {
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'EUR · EURC' }))
}

export async function selectUsdc() {
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'USD · USDC' }))
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The activity row of an operation, found by its amount. */
export const historyRow = (amount: string) => screen.findByRole('button', { name: new RegExp(escape(amount)) })

/** Opens an operation from activity unless the URL already reopened it. */
export async function openOperation(amount: string) {
    const target = await waitFor(() => {
        const confirm = screen.queryByRole('button', { name: 'confirm' })
        if (confirm) return confirm
        const row = screen.queryByRole('button', { name: new RegExp(escape(amount)) })
        if (!row) throw new Error(`neither the review nor the ${amount} activity row is on screen`)
        return row
    })
    if (target.textContent?.trim() !== 'confirm') fireEvent.click(target)
}

/**
 * After a remount or reload: reopen the operation if the screen offers it and
 * press Confirm if it is shown. Never fails on its own, so an implementation
 * that resumes by itself is judged only by what reaches the server.
 */
export async function reopenAndConfirm(amount: string) {
    const target = await waitFor(
        () => {
            const confirm = screen.queryByRole('button', { name: 'confirm' })
            if (confirm) return confirm
            const row = screen.queryByRole('button', { name: new RegExp(escape(amount)) })
            if (!row) throw new Error('not yet')
            return row
        },
        { timeout: 2_000 }
    ).catch(() => null)
    if (target && target.textContent?.trim() !== 'confirm') fireEvent.click(target)
    const confirm = await screen.findByRole('button', { name: 'confirm' }, { timeout: 1_500 }).catch(() => null)
    if (confirm) fireEvent.click(confirm)
}

/** The JSON body of each submit sent for an operation, in order. */
export const submittedBodies = (id: string) =>
    server.calls('POST', new RegExp(`/operations/${escape(id)}/submit$`)).map((request) => request.body)
