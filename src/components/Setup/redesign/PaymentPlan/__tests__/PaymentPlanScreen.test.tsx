/** @jest-environment jsdom */
/**
 * 08 Payment plan (`payment-plan`), contract P3 § 4: loading, pre-fill, drawers, labels, clear-on-change, Continue
 * and the save. Copy keys are the contract's (§ 4.4), read from the real catalogs.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import posthog from 'posthog-js'
import type { KycIntents } from '@/hooks/useKycIntents'
import type { AppLocale } from '@/i18n/app/config'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { __resetSignupSavesForTests } from '@/features/setup/saveSignupAnswers'
import { signupControls } from '@/test-utils/signup-controls'
import { PaymentPlanScreen } from '../PaymentPlanScreen'
import {
    copy,
    copyRx,
    type FlowSeed,
    footer,
    renderRedesign,
    setupState,
    visibleText,
} from '../../Accounts/__tests__/redesignHarness'

// ---- boundaries -------------------------------------------------------------------------------------------

const mockHandleNext = jest.fn()
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), setPersonProperties: jest.fn(), register: jest.fn() },
}))
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 20,
            frameRate: 30,
            addEventListener: jest.fn(),
            destroy: jest.fn(),
            goToAndStop: jest.fn(),
        }),
    },
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))

let mockUserId: string | null = 'user-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
// Never settles: the step must move on without waiting for the save.
const mockUpdateUserById = jest.fn((_payload: Record<string, unknown>) => new Promise(() => undefined))
jest.mock('@/app/actions/users', () => ({
    updateUserById: (payload: Record<string, unknown>) => mockUpdateUserById(payload),
}))

let mockSets: unknown
let mockSetsSettled = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    const fixture = () => jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS
    return {
        ...actual,
        useResidenceRestrictionSetsWithStatus: () => ({
            sets: mockSetsSettled ? (mockSets ?? fixture()) : null,
            settled: mockSetsSettled,
        }),
        useResidenceRestrictionSets: () => (mockSetsSettled ? (mockSets ?? fixture()) : null),
    }
})

let mockIntentsSettled = true
let mockIntentsMissing = false
let mockIntentsOverride: Record<string, KycIntents> = {}
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) => ({
        intents:
            mockIntentsSettled && !mockIntentsMissing
                ? (mockIntentsOverride[country] ??
                  jest.requireActual('@/test-utils/kycIntents.fixture').KYC_INTENTS_BY_COUNTRY[country])
                : undefined,
        settled: mockIntentsSettled,
    }),
}))

// ---- helpers ------------------------------------------------------------------------------------------------

const capture = posthog.capture as jest.Mock
const controls = () => signupControls(capture)
const K = 'setupRedesign.plan'
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const plain = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/** The text a pill shows: hidden sizing copies (aria-hidden or `invisible`) and screen-reader text left out. */
function shownText(el: Element): string {
    const clone = el.cloneNode(true) as Element
    clone.querySelectorAll('[aria-hidden="true"], .invisible, .sr-only').forEach((node) => node.remove())
    return visibleText(clone)
}

function render(seed: FlowSeed, options: { locale?: AppLocale; onFinish?: () => Promise<void> } = {}) {
    const locale = options.locale ?? 'en'
    const view = renderRedesign(<PaymentPlanScreen />, {
        screenId: 'payment-plan',
        seed,
        locale,
        onFinish: options.onFinish,
        showBackButton: true,
    })
    const title = (kind: 'funding' | 'payment') => copy(`${K}.${kind}Title`, {}, locale)
    const pill = (kind: 'funding' | 'payment') =>
        screen.getByRole('button', { name: new RegExp(`^${escapeRx(title(kind))}:`), hidden: true })
    const continueButton = () =>
        within(footer(view.container)!).getByRole('button', {
            name: copyRx('setupRedesign.common.continue', {}, locale),
            hidden: true,
        })
    const rows = () =>
        within(screen.getByRole('dialog'))
            .getAllByRole('button')
            .map((b) => plain(b.getAttribute('aria-label') || visibleText(b)))
            .filter(Boolean)
    const open = (kind: 'funding' | 'payment') => {
        fireEvent.click(pill(kind))
        return rows()
    }
    const choose = async (kind: 'funding' | 'payment', label: string) => {
        fireEvent.click(pill(kind))
        const dialog = screen.getByRole('dialog')
        fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${escapeRx(label)}$`) }))
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
    return { ...view, title, pill, continueButton, rows, open, choose }
}

const label = (key: string, values: Record<string, string> = {}, locale: AppLocale = 'en') =>
    copy(`${K}.${key}`, values, locale)

beforeEach(() => {
    jest.clearAllMocks()
    __resetSignupSavesForTests()
    mockIsLoading = false
    mockUserId = 'user-1'
    mockSets = undefined
    mockSetsSettled = true
    mockIntentsSettled = true
    mockIntentsMissing = false
    mockIntentsOverride = {}
})

describe('08 Payment plan', () => {
    it('P3-38 while the options load: both pills busy with a spinner on Choose, nothing opens, Continue off', () => {
        mockSetsSettled = false
        mockIntentsSettled = false
        const view = render({ residenceCountry: 'US' })
        expect(setupState(view.container)).toBe('loading')
        for (const kind of ['funding', 'payment'] as const) {
            const pill = view.pill(kind)
            expect(pill).toHaveAccessibleName(`${view.title(kind)}: ${label('choose')}`)
            expect(pill).toBeDisabled()
            expect(pill).toHaveAttribute('aria-busy', 'true')
            expect(within(pill).getByRole('status', { hidden: true })).toBeInTheDocument()
            fireEvent.click(pill)
        }
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(controls()).toEqual([])
        expect(view.continueButton()).toBeDisabled()
    })

    it('P3-39 settled for US: funding [bank, crypto, peanut], spending [card, qr], both on Choose, Continue off until both are picked', async () => {
        mockIntentsOverride = {
            US: {
                qr: { available: true },
                local: { available: false, reason: 'local_residence_unsupported' },
                card: { available: true },
                bank: { available: true, currencies: ['USD', 'EUR'] },
            } as KycIntents,
        }
        const view = render({ residenceCountry: 'US' })
        expect(setupState(view.container)).toBe('default')
        expect(view.pill('funding')).toHaveAccessibleName(`${view.title('funding')}: ${label('choose')}`)
        expect(view.pill('payment')).toHaveAccessibleName(`${view.title('payment')}: ${label('choose')}`)
        expect(view.continueButton()).toBeDisabled()

        expect(view.open('funding')).toEqual([
            label('fundBankCurrencies', { currencies: 'USD, EUR' }),
            label('fundCrypto'),
            label('fundPeanut'),
        ])
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        expect(view.open('payment')).toEqual([label('payCard'), label('payQr')])
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

        await view.choose('funding', label('fundBankCurrencies', { currencies: 'USD, EUR' }))
        expect(view.continueButton()).toBeDisabled()
        await view.choose('payment', label('payQr'))
        expect(view.flow().fundingChannel).toBe('bank')
        expect(view.flow().paymentChannel).toBe('qr')
        expect(setupState(view.container)).toBe('filled')
        expect(view.continueButton()).toBeEnabled()
    })

    it('P3-41 a one-option spending list (peanut) arrives filled, without a select event; funding stays on Choose', async () => {
        const view = render({ residenceCountry: 'IR' })
        await waitFor(() => expect(view.flow().paymentChannel).toBe('peanut'))
        expect(shownText(view.pill('payment'))).toBe(label('peanutPill'))
        expect(controls()).not.toContain('payment_channel:select:peanut')
        expect(view.pill('funding')).toHaveAccessibleName(`${view.title('funding')}: ${label('choose')}`)
        expect(setupState(view.container)).toBe('prefilled')
    })

    it('P3-41 a one-option list of the card is pre-filled the same way', async () => {
        mockIntentsOverride = {
            PT: {
                qr: { available: false, reason: 'residence_sanctioned' },
                local: { available: false, reason: 'local_residence_unsupported' },
                card: { available: true },
                bank: { available: true, currencies: ['USD', 'EUR'] },
            } as KycIntents,
        }
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
        }
        const view = render({ residenceCountry: 'PT' })
        await waitFor(() => expect(view.flow().paymentChannel).toBe('card'))
        expect(shownText(view.pill('payment'))).toBe(label('payCard'))
        expect(controls()).toEqual([])
    })

    it('P3-41 a two-option spending list is never pre-filled', async () => {
        const view = render({ residenceCountry: 'PT' })
        await waitFor(() => expect(setupState(view.container)).toBe('default'))
        expect(view.flow().paymentChannel).toBeNull()
        expect(view.pill('payment')).toHaveAccessibleName(`${view.title('payment')}: ${label('choose')}`)
    })

    it('P3-42 funding is never pre-filled', async () => {
        const view = render({ residenceCountry: 'IR' })
        await waitFor(() => expect(view.flow().paymentChannel).toBe('peanut'))
        expect(view.flow().fundingChannel).toBeNull()
    })

    it.each(['en', 'es-AR'] as const)(
        'P3-43 drawer titles "Add money with" / "Spend with", rows with full labels, icon bubbles and a check on the choice (%s)',
        async (locale) => {
            const view = render({ residenceCountry: 'PT' }, { locale })
            fireEvent.click(view.pill('funding'))
            const dialog = screen.getByRole('dialog')
            expect(within(dialog).getByText(copyRx(`${K}.fundingTitle`, {}, locale))).toBeInTheDocument()
            const crypto = within(dialog).getByRole('button', { name: copyRx(`${K}.fundCrypto`, {}, locale) })
            expect(crypto.querySelector('.rounded-full')).not.toBeNull()
            fireEvent.click(crypto)
            await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
            fireEvent.click(view.pill('funding'))
            const again = screen.getByRole('dialog')
            expect(within(again).getByRole('button', { name: copyRx(`${K}.fundCrypto`, {}, locale) })).toHaveClass(
                'bg-background-selection'
            )
            expect(within(again).getByRole('button', { name: copyRx(`${K}.fundPeanut`, {}, locale) })).not.toHaveClass(
                'bg-background-selection'
            )
            fireEvent.keyDown(again, { key: 'Escape' })
            await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
            fireEvent.click(view.pill('payment'))
            expect(
                within(screen.getByRole('dialog')).getByText(copyRx(`${K}.paymentTitle`, {}, locale))
            ).toBeInTheDocument()
        }
    )

    it('P3-44 the bank row names the served currencies in served order', () => {
        mockIntentsOverride = {
            DE: {
                qr: { available: true },
                local: { available: false, reason: 'local_residence_unsupported' },
                card: { available: true },
                bank: { available: true, currencies: ['USD', 'EUR', 'GBP', 'MXN'] },
            } as KycIntents,
        }
        const view = render({ residenceCountry: 'DE' })
        expect(view.open('funding')[0]).toBe(label('fundBankCurrencies', { currencies: 'USD, EUR, GBP, MXN' }))
        expect(view.open('funding')[0]).toContain('USD, EUR, GBP, MXN')
    })

    it('P3-44 after a failed intents read the bank row is plain "Bank transfer"', () => {
        mockIntentsMissing = true
        const view = render({ residenceCountry: 'PT' })
        expect(view.open('funding')).toEqual([label('fundBank'), label('fundCrypto'), label('fundPeanut')])
    })

    it.each(['en', 'es-AR'] as const)(
        'P3-45 bank and QR picked: the pills show the short labels (%s)',
        async (locale) => {
            const view = render({ residenceCountry: 'PT' }, { locale })
            await view.choose('funding', label('fundBankCurrencies', { currencies: 'USD, EUR, GBP, MXN' }, locale))
            await view.choose('payment', label('payQr', {}, locale))
            expect(shownText(view.pill('funding'))).toBe(label('fundBankPill', {}, locale))
            expect(shownText(view.pill('payment'))).toBe(label('payQr', {}, locale))
            // the accessible name keeps the full sheet label
            expect(view.pill('funding')).toHaveAccessibleName(
                `${view.title('funding')}: ${label('fundBankCurrencies', { currencies: 'USD, EUR, GBP, MXN' }, locale)}`
            )
        }
    )

    it.each(['en', 'es-AR'] as const)('P3-45 a Peanut-user top-up shows the Peanut-user pill (%s)', async (locale) => {
        const view = render({ residenceCountry: 'JP' }, { locale })
        await view.choose('funding', label('fundPeanut', {}, locale))
        expect(shownText(view.pill('funding'))).toBe(label('peanutPill', {}, locale))
        expect(view.flow().fundingChannel).toBe('peanut')
    })

    it('P3-45 Brazil’s local bank pill reads "Pix" with the Pix mark and saves brlBank', async () => {
        const view = render({ residenceCountry: 'BR' })
        expect(view.open('funding')[0]).toBe(label('fundBrlBank'))
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        await view.choose('funding', label('fundBrlBank'))
        expect(shownText(view.pill('funding'))).toBe(label('fundBrlBankPill'))
        expect(view.pill('funding').querySelector('img')).not.toBeNull()
        expect(view.flow().fundingChannel).toBe('brlBank')
    })

    it('P3-45 / K3 Argentina’s local bank pill reads "Banco ARS" in es-AR', async () => {
        const view = render({ residenceCountry: 'AR' }, { locale: 'es-AR' })
        expect(view.open('funding')[0]).toBe(label('fundArsBank', {}, 'es-AR'))
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        await view.choose('funding', label('fundArsBank', {}, 'es-AR'))
        expect(shownText(view.pill('funding'))).toBe(label('fundArsBankPill', {}, 'es-AR'))
        expect(view.flow().fundingChannel).toBe('arsBank')
    })

    it('P3-46 drawer events: open, select with the channel id, dismiss; Continue with both reports and moves on once', async () => {
        const view = render({ residenceCountry: 'PT' })
        await view.choose('funding', label('fundCrypto'))
        fireEvent.click(view.pill('payment'))
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
        await view.choose('payment', label('payQr'))
        fireEvent.click(view.continueButton())
        expect(controls()).toEqual([
            'funding_channel:open',
            'funding_channel:select:crypto',
            'payment_channel:open',
            'payment_channel:dismiss',
            'payment_channel:open',
            'payment_channel:select:qr',
            'continue:tap',
        ])
        expect(capture.mock.calls[0][1]).toEqual(
            expect.objectContaining({ screen_id: 'payment-plan', setup_host: 'signup' })
        )
        expect(view.flow().fundingChannel).toBe('crypto')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-47 a stored choice the residence no longer offers shows Choose and is cleared once settled', async () => {
        const view = render({ residenceCountry: 'US', fundingChannel: 'brlBank', paymentChannel: 'card' })
        expect(view.pill('funding')).toHaveAccessibleName(`${view.title('funding')}: ${label('choose')}`)
        await waitFor(() => expect(view.flow().fundingChannel).toBeNull())
        expect(view.flow().paymentChannel).toBe('card')
        expect(view.continueButton()).toBeDisabled()
    })

    it('P3-47 a choice the new residence drops is cleared when the residence changes', async () => {
        const view = render({ residenceCountry: 'PT', fundingChannel: 'bank', paymentChannel: 'card' })
        expect(view.flow().fundingChannel).toBe('bank')
        act(() => view.flow().setResidenceCountry('JP'))
        await waitFor(() => expect(view.flow().fundingChannel).toBeNull())
        expect(view.flow().paymentChannel).toBe('card')
    })

    it('P3-48 Continue for a fully restricted residence reports it; an unrestricted one does not', async () => {
        const gb = render({ residenceCountry: 'GB' })
        await gb.choose('funding', label('fundCrypto'))
        await gb.choose('payment', label('payQr'))
        fireEvent.click(gb.continueButton())
        expect(capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED,
            expect.objectContaining({ residence_country: 'GB' })
        )
        gb.unmount()
        capture.mockClear()
        const pt = render({ residenceCountry: 'PT' })
        await pt.choose('funding', label('fundCrypto'))
        await pt.choose('payment', label('payQr'))
        fireEvent.click(pt.continueButton())
        expect(
            capture.mock.calls.filter(([e]) => e === ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED)
        ).toEqual([])
        expect(controls()).toContain('continue:tap')
    })

    it('P3-49 signed in and no host: Continue saves the plan once without waiting', async () => {
        const view = render({ residenceCountry: 'PT' })
        await view.choose('funding', label('fundCrypto'))
        await view.choose('payment', label('payQr'))
        fireEvent.click(view.continueButton())
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1)
        expect(mockUpdateUserById).toHaveBeenCalledWith({
            userId: 'user-1',
            signupPreferences: { fundingChannel: 'crypto', paymentChannel: 'qr' },
        })
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-49 the verify prelude (onFinish) and a sign-up before the account save nothing on Continue', async () => {
        const prelude = render({ residenceCountry: 'PT' }, { onFinish: async () => undefined })
        await prelude.choose('funding', label('fundCrypto'))
        await prelude.choose('payment', label('payQr'))
        fireEvent.click(prelude.continueButton())
        expect(capture.mock.calls.find(([e]) => e === 'control_used')?.[1]).toEqual(
            expect.objectContaining({ setup_host: 'verify-prelude' })
        )
        prelude.unmount()
        mockUserId = null
        const draft = render({ residenceCountry: 'PT' })
        await draft.choose('funding', label('fundCrypto'))
        await draft.choose('payment', label('payQr'))
        fireEvent.click(draft.continueButton())
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        expect(draft.flow().fundingChannel).toBe('crypto')
        expect(draft.flow().paymentChannel).toBe('qr')
        expect(mockHandleNext).toHaveBeenCalledTimes(2)
    })

    it('P3-46 Continue does nothing while the flow is loading (advancing)', async () => {
        const view = render({ residenceCountry: 'PT', fundingChannel: 'crypto', paymentChannel: 'qr' })
        mockIsLoading = true
        view.rerenderSame()
        expect(view.continueButton()).toBeDisabled()
        fireEvent.click(view.continueButton())
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it.each(['en', 'es-AR'] as const)('P3-08 / P3-52 no banned word and no hint line on 08 (%s)', async (locale) => {
        const view = render({ residenceCountry: 'PT' }, { locale })
        expect(visibleText(view.container)).not.toMatch(
            /platinum|cashback|bono|no password|sin contraseña|suggested|example|ejemplo/i
        )
        expect(visibleText(view.container)).not.toContain(copy('setup.paymentPlan.hint', {}, locale))
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx(`${K}.title`, {}, locale))
    })
})
