/**
 * Monerium EUR account: the EURE account view, the onboarding steps and the
 * euro withdrawal, driven through the real home tree. Only the I/O edges are
 * faked: `apiFetch` (the in-memory EURE routes below, on top of the EURC
 * harness), the message signer and the Arbitrum balance read.
 *
 * Copy is asserted by translation key. Keys live in the `currencyAccounts.monerium`
 * namespace and are matched by their dotted suffix, so the namespace prefix is free:
 *   share.consent  share.continue  form.submit  form.field.<field>  link.sign
 *   iban.request  wait.title  unavailable.title  addEuros  withdrawEuros  copyIban
 *   accountHolder  withdraw.account  withdraw.amount  withdraw.addBank
 *   withdraw.viewPending  withdraw.invalidAmount  withdraw.error.<code>  error.<code>
 *   withdraw.status.<status>
 * with <code> the camelCase wire code (kyc_sharing_unavailable -> kycSharingUnavailable)
 * and `generic` for anything unknown. `review` / `confirm` are the existing EURC keys.
 */
process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL = 'https://bundler.test'
process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL = 'https://paymaster.test'

import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { EURC_ACCOUNT, lostResponse, renderHome, selectEurc, server, type FakeRequest } from './eurcHomeHarness'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'
import { MoneriumAccountView } from '../MoneriumAccountView'
import { MoneriumOnboardingView } from '../MoneriumOnboardingView'
import { MoneriumWithdrawView } from '../MoneriumWithdrawView'

const WALLET = `0x${'12'.repeat(20)}`
const EURE_TOKEN = '0x0c06ccf38114ddfc35e07427b9424adcca9f44f8'
const IBAN = 'DE89370400440532013000'
const IBAN_GROUPED = 'DE89 3704 0044 0532 0130 00'
const SAVED_IBAN = 'ES9121000418450200051332'
const SIGNATURE = `0x${'ef'.repeat(65)}`
const LINK_MESSAGE = 'I hereby declare that I am the address owner.'
const WITHDRAW_MESSAGE = 'Send EUR 10.50 to ES9121000418450200051332 at 2026-10-12T10:00:00Z'
const BASE = '/users/currency-accounts/EURE'

type Reply = { status: number; body: unknown } | Error
type Respond = (request: FakeRequest) => Reply | Promise<Reply>

const remediation = { resolveGate: jest.fn(), verifyCorridor: jest.fn() }
const signer = { sign: jest.fn(async (_message: string): Promise<string> => SIGNATURE) }
const balance = {
    read: jest.fn(async (_args: Record<string, unknown>): Promise<bigint> => 12_340_000_000_000_000_000n),
}
const publicClientChains: number[] = []
const locale = { current: 'es' }
const copyText = jest.fn(async (_text: string) => true)
const writeText = jest.fn(async (_text: string) => undefined)
const auth = {
    userId: 'alice',
    fetchUser: jest.fn(async () => undefined),
    user: {
        user: { userId: 'alice', fullName: 'Alice Example' },
        accounts: [
            { type: 'peanut-wallet', identifier: WALLET },
            {
                id: 'iban-1',
                type: 'iban',
                identifier: SAVED_IBAN,
                label: 'Savings',
                bridgeAccountId: 'bridge-1',
                userId: 'alice',
                chainId: null,
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
                details: {
                    bankName: null,
                    accountOwnerName: 'Alice Example',
                    countryCode: 'ES',
                    countryName: 'Spain',
                },
            },
        ],
    },
}
const toastStub = new Proxy({}, { get: () => jest.fn() })

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, options?: RequestInit) => require('./eurcHomeHarness').fakeApiFetch(path, options),
}))
jest.mock('@/hooks/wallet/useSignUserOp', () => ({
    useSignUserOp: () => ({
        signCallsUserOp: (...args: unknown[]) => require('./eurcHomeHarness').passkey.sign(...args),
    }),
}))
jest.mock('@/hooks/wallet/useMoneriumSigner', () => ({
    useMoneriumSigner: () => ({ signMoneriumMessage: (message: string) => signer.sign(message) }),
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ ensureClientForChain: async () => undefined }),
}))
jest.mock('@/app/actions/clients', () => ({
    ...jest.requireActual('@/app/actions/clients'),
    getPublicClient: (chainId: number) => {
        publicClientChains.push(Number(chainId))
        return { readContract: (args: Record<string, unknown>) => balance.read(args) }
    },
    peanutPublicClient: { readContract: (args: Record<string, unknown>) => balance.read(args) },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => auth }))
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ ...remediation, modals: null }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => ({ kind: 'ready' }) }),
}))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('next-intl', () => ({
    ...jest.requireActual('next-intl'),
    useTranslations: () => (key: string) => key,
    useLocale: () => locale.current,
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CurrencyBalanceNotice', () => ({ CurrencyBalanceNotice: () => null }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    ...jest.requireActual('@/components/0_Bruddle/Toast'),
    useToast: () => toastStub,
}))
jest.mock('@/utils/clipboard.utils', () => ({
    ...jest.requireActual('@/utils/clipboard.utils'),
    copyTextToClipboard: (text: string) => copyText(text),
}))
jest.mock('../EurcBankAccountView', () => ({ EurcBankAccountView: () => <div>sepa bank form</div> }))
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({
    DynamicBankAccountForm: () => <div>sepa bank form</div>,
}))
jest.mock('../../views/BalanceSection', () => ({
    BalanceSection: ({
        balance: amount,
        decimals,
        currencySymbol = '$',
    }: {
        balance: bigint
        decimals?: number
        currencySymbol?: string
    }) => <div>{`${currencySymbol}:${amount}:${decimals ?? 6}`}</div>,
}))
jest.mock('@/components/0_Bruddle/BaseSelect', () => ({
    BaseSelect: ({ options, onValueChange, placeholder: _placeholder, ...props }: any) => (
        <select {...props} onChange={(event) => onValueChange(event.target.value)}>
            <option value="" />
            {options.map((option: any) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    ),
}))

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const key = (suffix: string) => new RegExp(`(^|\\.)${escape(suffix)}$`)
const camel = (code: string) => code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
const ADD_EUR = /^(addEur\w*|EUR)$/
const REVIEW = /(^|\.)review$/
const CONFIRM = /(^|\.)confirm$/

const ok = (body: unknown): Reply => ({ status: 200, body })
const refuse = (status: number, code: string): Reply => ({ status, body: { error: code } })
const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
    })

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
const EURE_ACCOUNT = {
    asset: 'EURE',
    currency: 'EUR',
    chainId: '42161',
    tokenAddress: EURE_TOKEN,
    decimals: 18,
    id: 'eure-1',
    address: WALLET,
    isDefault: false,
}

const snapshot = (nextStep: string, extra: Record<string, unknown> = {}) => ({
    state: nextStep === 'done' ? 'APPROVED' : 'SHARING',
    nextStep,
    iban: null,
    reason: null,
    ...extra,
})
const capabilities = (extra: Record<string, unknown> = {}) => ({
    provider: 'MONERIUM',
    receive: true,
    bankDeposit: true,
    bankWithdraw: true,
    send: false,
    exchange: false,
    onboarding: 'done',
    iban: IBAN,
    bankingBlock: null,
    ...extra,
})
const operationSnapshot = (status: string) => ({
    id: 'op-1',
    operationId: 'op-1',
    kind: 'BANK_WITHDRAW',
    sourceAsset: 'EURE',
    amount: '10.50',
    status,
    errorCode: status === 'FAILED' ? 'monerium_refused' : null,
})

type Step = 'share' | 'form' | 'link' | 'iban' | 'wait' | 'done' | 'unavailable'
const world = {
    hasEure: false,
    onboarding: ok(snapshot('share')) as Reply,
    events: [] as string[],
    replies: {} as Partial<
        Record<
            'share' | 'form' | 'linkMessage' | 'link' | 'iban' | 'prepare' | 'submit' | 'operation' | 'accountsPost',
            Respond
        >
    >,
}
const defaults: Record<keyof typeof world.replies, Respond> = {
    share: () => ok(snapshot('form')),
    form: () => ok(snapshot('link')),
    linkMessage: () => ok({ message: LINK_MESSAGE }),
    link: () => ok(snapshot('iban')),
    iban: () => ok(snapshot('done', { iban: IBAN })),
    prepare: () => ok({ operationId: 'op-1', message: WITHDRAW_MESSAGE, status: 'READY' }),
    submit: () => ok({ operationId: 'op-1', status: 'PROCESSING', errorCode: null }),
    operation: () => ok(operationSnapshot('COMPLETED')),
    accountsPost: () => ok({ account: EURC_ACCOUNT }),
}
const reply = (name: keyof typeof defaults, request: FakeRequest) => {
    world.events.push(name)
    return (world.replies[name] ?? defaults[name])(request)
}

function installWorld() {
    server.handlers.push((request) => {
        const { method, path } = request
        const [pathname] = path.split('?')
        if (pathname === '/users/currency-accounts') {
            if (method === 'POST') return reply('accountsPost', request)
            return ok({
                accounts: world.hasEure ? [USDC_ACCOUNT, EURE_ACCOUNT] : [USDC_ACCOUNT],
                available: world.hasEure ? [] : [EURC_ASSET],
            })
        }
        if (!pathname.startsWith(`${BASE}/`)) return undefined
        const rest = pathname.slice(BASE.length + 1)
        if (method === 'GET' && rest === 'onboarding') return world.onboarding
        if (method === 'POST' && rest === 'onboarding/share') return reply('share', request)
        if (method === 'POST' && rest === 'onboarding/form') return reply('form', request)
        if (method === 'GET' && rest === 'onboarding/link-message') return reply('linkMessage', request)
        if (method === 'POST' && rest === 'onboarding/link') return reply('link', request)
        if (method === 'POST' && rest === 'onboarding/iban') return reply('iban', request)
        if (method === 'GET' && rest === 'capabilities') return ok(capabilities())
        if (method === 'GET' && rest === 'history')
            return ok({ entries: [], operations: [], cursor: null, hasMore: false })
        if (method === 'POST' && rest === 'operations') return reply('prepare', request)
        if (method === 'POST' && /^operations\/[^/]+\/submit$/.test(rest)) return reply('submit', request)
        if (method === 'GET' && /^operations\/[^/]+$/.test(rest)) return reply('operation', request)
        return undefined
    })
}

const calls = (method: string, pattern: RegExp) => server.calls(method, pattern)
const bodies = (method: string, pattern: RegExp) => calls(method, pattern).map((request) => request.body)
const sepaVerificationStarted = () => remediation.verifyCorridor.mock.calls.some(([corridor]) => corridor === 'SEPA_EU')

beforeEach(() => {
    server.reset()
    world.hasEure = false
    world.onboarding = ok(snapshot('share'))
    world.events = []
    world.replies = {}
    installWorld()
    remediation.resolveGate.mockClear()
    remediation.verifyCorridor.mockClear()
    signer.sign.mockReset()
    signer.sign.mockImplementation(async (message: string) => {
        world.events.push('sign')
        void message
        return SIGNATURE
    })
    balance.read.mockClear()
    publicClientChains.length = 0
    locale.current = 'es'
    copyText.mockClear()
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

async function openOnboarding(nextStep: Step, extra: Record<string, unknown> = {}) {
    world.onboarding = ok(snapshot(nextStep, extra))
    renderHome()
    fireEvent.click(await screen.findByRole('button', { name: /addAccount/ }))
    fireEvent.click(await screen.findByRole('button', { name: ADD_EUR }))
}

async function openAccount() {
    world.hasEure = true
    renderHome()
    await selectEurc()
    await screen.findByRole('button', { name: key('addEuros') })
}

describe('which EUR account the home shows', () => {
    it('exports the three Monerium views', () => {
        expect(typeof MoneriumAccountView).toBe('function')
        expect(typeof MoneriumOnboardingView).toBe('function')
        expect(typeof MoneriumWithdrawView).toBe('function')
    })

    it('renders the Monerium view, not the EURC one, for an EURE account', async () => {
        await openAccount()
        expect(await screen.findByRole('button', { name: key('withdrawEuros') })).toBeInTheDocument()
        expect(calls('GET', /\/EURC\//)).toHaveLength(0)
        expect(screen.queryByRole('button', { name: 'send' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'exchange' })).not.toBeInTheDocument()
    })

    it('shows the EURE balance with 18 decimals, read from the Arbitrum token', async () => {
        await openAccount()
        expect(await screen.findByText('€:12340000000000000000:18')).toBeInTheDocument()
        await waitFor(() =>
            expect(balance.read.mock.calls.some(([args]) => String(args.address).toLowerCase() === EURE_TOKEN)).toBe(
                true
            )
        )
        expect(publicClientChains.every((chainId) => chainId === 42161)).toBe(true)
    })
})

describe('adding a EUR account', () => {
    it("opens Monerium onboarding and does not add an EURC account when onboarding says 'share'", async () => {
        await openOnboarding('share')
        expect(await screen.findByRole('button', { name: key('share.continue') })).toBeInTheDocument()
        await settle()
        expect(calls('GET', /\/EURE\/onboarding$/).length).toBeGreaterThan(0)
        expect(calls('POST', /^\/users\/currency-accounts$/)).toHaveLength(0)
    })

    it.each([
        ['onboarding is unavailable', () => ok(snapshot('unavailable', { reason: 'not_available' }))],
        ['the onboarding call is refused', () => refuse(500, 'internal_error')],
        ['the onboarding call is lost', () => lostResponse()],
    ])('keeps the EURC add flow when %s', async (_name, onboarding) => {
        world.onboarding = onboarding() as Reply
        renderHome()
        fireEvent.click(await screen.findByRole('button', { name: /addAccount/ }))
        fireEvent.click(await screen.findByRole('button', { name: ADD_EUR }))
        await waitFor(() => expect(calls('POST', /^\/users\/currency-accounts$/)).toHaveLength(1))
        expect(bodies('POST', /^\/users\/currency-accounts$/)[0]).toEqual({ asset: 'EURC' })
        expect(screen.queryByRole('button', { name: key('share.continue') })).not.toBeInTheDocument()
    })
})

describe('onboarding steps', () => {
    it('share: explains the consent and calls share() on continue', async () => {
        await openOnboarding('share')
        expect(await screen.findByText(key('share.consent'))).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: key('share.continue') }))
        await waitFor(() => expect(calls('POST', /\/onboarding\/share$/)).toHaveLength(1))
        expect(await screen.findByRole('button', { name: key('form.submit') })).toBeInTheDocument()
    })

    it("share: starts the SEPA verification flow on 'verification_required'", async () => {
        world.replies.share = () => refuse(409, 'verification_required')
        await openOnboarding('share')
        fireEvent.click(await screen.findByRole('button', { name: key('share.continue') }))
        await waitFor(() => expect(sepaVerificationStarted()).toBe(true))
    })

    it("share: says it is not available yet on 'kyc_sharing_unavailable' without retrying", async () => {
        world.replies.share = () => refuse(503, 'kyc_sharing_unavailable')
        await openOnboarding('share')
        fireEvent.click(await screen.findByRole('button', { name: key('share.continue') }))
        expect(await screen.findByText(key('error.kycSharingUnavailable'))).toBeInTheDocument()
        await settle()
        expect(calls('POST', /\/onboarding\/share$/)).toHaveLength(1)
        expect(screen.queryByRole('button', { name: /retry/ })).not.toBeInTheDocument()
        expect(sepaVerificationStarted()).toBe(false)
    })

    describe('form', () => {
        const SELECTS = [
            'occupation',
            'profession',
            'fundOrigin',
            'annualIncome',
            'monthlyTurnover',
            'monthlyTransactionCount',
            'activities',
            'taxResidenceCountry',
        ]
        const DECLARATIONS = ['publicFunction', 'fundOwner', 'usCitizen', 'usTaxPerson']

        async function fillForm() {
            const expected: Record<string, unknown> = {}
            for (const field of SELECTS) {
                const select = (await screen.findByLabelText(key(`form.field.${field}`))) as HTMLSelectElement
                const option = [...select.options].find((candidate) => candidate.value)
                if (!option) throw new Error(`no option to choose for ${field}`)
                fireEvent.change(select, { target: { value: option.value } })
                expected[field] = option.value
            }
            for (const field of DECLARATIONS) {
                const select = (await screen.findByLabelText(key(`form.field.${field}`))) as HTMLSelectElement
                const no = [...select.options].find((candidate) => /^(no|false)$/i.test(candidate.value))
                if (!no) throw new Error(`no "no" option for ${field}`)
                fireEvent.change(select, { target: { value: no.value } })
                expected[field] = false
            }
            fireEvent.change(await screen.findByLabelText(key('form.field.tin')), { target: { value: '123456789' } })
            expected.tin = '123456789'
            return expected
        }

        it('submits the answers, with booleans for the declarations', async () => {
            await openOnboarding('form')
            const expected = await fillForm()
            fireEvent.click(await screen.findByRole('button', { name: key('form.submit') }))
            await waitFor(() => expect(calls('POST', /\/onboarding\/form$/)).toHaveLength(1))
            const sent = bodies('POST', /\/onboarding\/form$/)[0] as Record<string, unknown>
            const { activities, ...rest } = sent
            const { activities: expectedActivities, ...expectedRest } = expected
            expect(rest).toEqual(expectedRest)
            expect([activities].flat()).toEqual([expectedActivities])
            expect(await screen.findByRole('button', { name: key('link.sign') })).toBeInTheDocument()
        })

        it("shows a field-level message on 'invalid_form'", async () => {
            world.replies.form = () => refuse(400, 'invalid_form')
            await openOnboarding('form')
            await fillForm()
            fireEvent.click(await screen.findByRole('button', { name: key('form.submit') }))
            expect(await screen.findByText(key('error.invalidForm'))).toBeInTheDocument()
            expect(screen.getByRole('button', { name: key('form.submit') })).toBeInTheDocument()
        })
    })

    describe('link', () => {
        it('gets the message, signs it, then posts the signature, in that order', async () => {
            await openOnboarding('link')
            fireEvent.click(await screen.findByRole('button', { name: key('link.sign') }))
            await waitFor(() => expect(calls('POST', /\/onboarding\/link$/)).toHaveLength(1))
            const order = world.events.filter((event) => ['linkMessage', 'sign', 'link'].includes(event))
            expect(order).toEqual(['linkMessage', 'sign', 'link'])
            expect(signer.sign).toHaveBeenCalledTimes(1)
            expect(signer.sign).toHaveBeenCalledWith(LINK_MESSAGE)
            expect(bodies('POST', /\/onboarding\/link$/)[0]).toEqual({ signature: SIGNATURE })
            expect(await screen.findByRole('button', { name: key('iban.request') })).toBeInTheDocument()
        })

        it('posts nothing when signing fails', async () => {
            signer.sign.mockRejectedValue(new Error('user cancelled'))
            await openOnboarding('link')
            fireEvent.click(await screen.findByRole('button', { name: key('link.sign') }))
            await screen.findByRole('alert')
            expect(calls('POST', /\/onboarding\/link$/)).toHaveLength(0)
        })

        it.each([
            ['wallet_not_deployed', 503, 'error.walletNotDeployed'],
            ['address_linked_elsewhere', 409, 'error.addressLinkedElsewhere'],
        ])("explains '%s' with its own message", async (code, status, copy) => {
            world.replies.link = () => refuse(status, code)
            await openOnboarding('link')
            fireEvent.click(await screen.findByRole('button', { name: key('link.sign') }))
            expect(await screen.findByText(key(copy))).toBeInTheDocument()
            expect(screen.queryByText(key('error.generic'))).not.toBeInTheDocument()
        })
    })

    it('iban: requests the IBAN and then shows the account', async () => {
        world.hasEure = false
        await openOnboarding('iban')
        fireEvent.click(await screen.findByRole('button', { name: key('iban.request') }))
        await waitFor(() => expect(calls('POST', /\/onboarding\/iban$/)).toHaveLength(1))
        expect(await screen.findByRole('button', { name: key('addEuros') })).toBeInTheDocument()
    })

    it('wait: says it is reviewing the details and offers no action', async () => {
        await openOnboarding('wait')
        expect(await screen.findByText(key('wait.title'))).toBeInTheDocument()
        for (const action of ['share.continue', 'form.submit', 'link.sign', 'iban.request']) {
            expect(screen.queryByRole('button', { name: key(action) })).not.toBeInTheDocument()
        }
    })

    it('unavailable: shows the reason as copy when onboarding is refused midway', async () => {
        world.replies.share = () => ok(snapshot('unavailable', { reason: 'residence_prohibited' }))
        await openOnboarding('share')
        fireEvent.click(await screen.findByRole('button', { name: key('share.continue') }))
        expect(await screen.findByText(key('unavailable.title'))).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: key('share.continue') })).not.toBeInTheDocument()
    })
})

describe('add euros', () => {
    it('shows the IBAN in groups of four with the holder name and a copy action', async () => {
        await openAccount()
        fireEvent.click(screen.getByRole('button', { name: key('addEuros') }))
        expect(await screen.findByText(IBAN_GROUPED)).toBeInTheDocument()
        expect(screen.getByText(auth.user.user.fullName)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: key('copyIban') }))
        await waitFor(() => {
            const copied = [...copyText.mock.calls, ...writeText.mock.calls].map(([text]) => text.replace(/\s/g, ''))
            expect(copied).toContain(IBAN)
        })
    })
})

describe('withdraw euros', () => {
    async function openWithdraw() {
        await openAccount()
        fireEvent.click(screen.getByRole('button', { name: key('withdrawEuros') }))
        await screen.findByLabelText(key('withdraw.account'))
    }

    async function fill(amount: string) {
        fireEvent.change(await screen.findByLabelText(key('withdraw.account')), { target: { value: 'iban-1' } })
        fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: amount } })
    }

    /** Presses whichever of review/confirm is on screen; after review, also confirm if the flow shows it. */
    async function next() {
        const first = await screen.findByRole('button', { name: /(^|\.)(review|confirm)$/ })
        const wasReview = REVIEW.test(first.textContent ?? '')
        fireEvent.click(first)
        if (!wasReview) return
        await waitFor(
            () => {
                if (!screen.queryByRole('button', { name: CONFIRM }) && !screen.queryByRole('alert'))
                    throw new Error('still preparing')
            },
            { timeout: 800 }
        ).catch(() => undefined)
        const confirm = screen.queryByRole('button', { name: CONFIRM })
        if (confirm) fireEvent.click(confirm)
    }

    const prepared = () => bodies('POST', /\/EURE\/operations$/) as Array<Record<string, unknown>>

    it('prepares once, signs the returned message, then submits the signature', async () => {
        await openWithdraw()
        await fill('10.5')
        await next()
        await waitFor(() => expect(calls('POST', /\/operations\/op-1\/submit$/)).toHaveLength(1))
        expect(prepared()).toHaveLength(1)
        expect(prepared()[0]).toEqual({
            requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
            kind: 'BANK_WITHDRAW',
            amount: '10.50',
            externalAccountId: 'iban-1',
        })
        expect(signer.sign).toHaveBeenCalledTimes(1)
        expect(signer.sign).toHaveBeenCalledWith(WITHDRAW_MESSAGE)
        expect(world.events.filter((event) => ['prepare', 'sign', 'submit'].includes(event))).toEqual([
            'prepare',
            'sign',
            'submit',
        ])
        expect(bodies('POST', /\/operations\/op-1\/submit$/)[0]).toEqual({ signature: SIGNATURE })
    })

    it.each([
        ['10,5', '10.50'],
        ['10.5', '10.50'],
        ['0,99', '0.99'],
        ['1250', '1250.00'],
    ])('sends %s euros as %s', async (typed, sent) => {
        await openWithdraw()
        await fill(typed)
        await next()
        await waitFor(() => expect(prepared()).toHaveLength(1))
        expect(prepared()[0].amount).toBe(sent)
    })

    it.each(['10.123', '0,001', '1,234.5'])('refuses %s before any request is made', async (typed) => {
        await openWithdraw()
        await fill(typed)
        const review = screen.queryByRole('button', { name: REVIEW }) as HTMLButtonElement | null
        if (review && !review.disabled) fireEvent.click(review)
        await settle()
        const refused = !review || review.disabled || !!screen.queryByText(key('withdraw.invalidAmount'))
        expect(refused).toBe(true)
        expect(prepared()).toHaveLength(0)
        expect(signer.sign).not.toHaveBeenCalled()
        expect(calls('POST', /\/submit$/)).toHaveLength(0)
    })

    it('reuses the request key when the prepare call is retried after a network failure', async () => {
        let attempt = 0
        world.replies.prepare = (request) => {
            attempt += 1
            return attempt === 1 ? lostResponse() : defaults.prepare(request)
        }
        await openWithdraw()
        await fill('10.5')
        await next()
        await screen.findByRole('alert')
        await next()
        await waitFor(() => expect(calls('POST', /\/operations\/op-1\/submit$/)).toHaveLength(1))
        expect(prepared()).toHaveLength(2)
        expect(prepared()[1].requestKey).toBe(prepared()[0].requestKey)
        expect(signer.sign).toHaveBeenCalledTimes(1)
    })

    it('does not submit when signing fails', async () => {
        signer.sign.mockRejectedValue(new Error('user cancelled'))
        await openWithdraw()
        await fill('10.5')
        await next()
        await screen.findByRole('alert')
        expect(calls('POST', /\/submit$/)).toHaveLength(0)
    })

    it("starts SEPA verification when the server refuses with 'verification_required'", async () => {
        world.replies.prepare = () => refuse(403, 'verification_required')
        await openWithdraw()
        await fill('10.5')
        await next()
        await waitFor(() => expect(sepaVerificationStarted()).toBe(true))
        expect(signer.sign).not.toHaveBeenCalled()
    })

    it('lets the user add a bank account through the SEPA form', async () => {
        await openWithdraw()
        fireEvent.click(await screen.findByRole('button', { name: key('withdraw.addBank') }))
        expect(await screen.findByText('sepa bank form')).toBeInTheDocument()
    })

    describe('refusals', () => {
        it.each([
            ['onboarding_incomplete', 409],
            ['invalid_amount', 400],
            ['amount_below_minimum', 400],
            ['supporting_document_required', 400],
            ['idempotency_conflict', 409],
            ['invalid_bank_account', 400],
            ['operation_in_flight', 409],
            ['insufficient_balance', 409],
            ['some_new_code', 500],
        ])("prepare: '%s' has its own message", async (code, status) => {
            world.replies.prepare = () => refuse(status, code)
            await openWithdraw()
            await fill('10.5')
            await next()
            const copy = code === 'some_new_code' ? 'withdraw.error.generic' : `withdraw.error.${camel(code)}`
            expect(await screen.findByText(key(copy))).toBeInTheDocument()
            expect(signer.sign).not.toHaveBeenCalled()
            if (code !== 'some_new_code')
                expect(screen.queryByText(key('withdraw.error.generic'))).not.toBeInTheDocument()
        })

        it("links to the pending operation on 'operation_in_flight'", async () => {
            world.replies.prepare = () => refuse(409, 'operation_in_flight')
            await openWithdraw()
            await fill('10.5')
            await next()
            expect(await screen.findByRole('button', { name: key('withdraw.viewPending') })).toBeInTheDocument()
        })

        it.each([
            ['operation_not_found', 404],
            ['operation_expired', 409],
            ['invalid_signature', 400],
            ['operation_already_submitted', 409],
            ['insufficient_balance', 409],
            ['monerium_refused', 502],
        ])("submit: '%s' has its own message", async (code, status) => {
            world.replies.submit = () => refuse(status, code)
            await openWithdraw()
            await fill('10.5')
            await next()
            expect(await screen.findByText(key(`withdraw.error.${camel(code)}`))).toBeInTheDocument()
            expect(screen.queryByText(key('withdraw.error.generic'))).not.toBeInTheDocument()
        })
    })

    describe('progress', () => {
        it.each([
            ['COMPLETED', 'withdraw.status.completed'],
            ['FAILED', 'withdraw.status.failed'],
            ['CANCELLED', 'withdraw.status.cancelled'],
            ['NEEDS_REVIEW', 'withdraw.status.needsReview'],
        ])('shows the %s status from operation(id)', async (status, copy) => {
            world.replies.operation = () => ok(operationSnapshot(status))
            await openWithdraw()
            await fill('10.5')
            await next()
            expect(await screen.findByText(key(copy))).toBeInTheDocument()
            expect(calls('GET', /\/operations\/op-1$/).length).toBeGreaterThan(0)
        })

        it('keeps polling operation(id) until the operation completes', async () => {
            let reads = 0
            world.replies.operation = () => {
                reads += 1
                return ok(operationSnapshot(reads < 2 ? 'PROCESSING' : 'COMPLETED'))
            }
            await openWithdraw()
            await fill('10.5')
            await next()
            expect(await screen.findByText(key('withdraw.status.processing'))).toBeInTheDocument()
            expect(screen.queryByText(key('withdraw.status.completed'))).not.toBeInTheDocument()
            expect(
                await screen.findByText(key('withdraw.status.completed'), {}, { timeout: 14_000 })
            ).toBeInTheDocument()
            expect(reads).toBeGreaterThanOrEqual(2)
        }, 25_000)
    })
})
