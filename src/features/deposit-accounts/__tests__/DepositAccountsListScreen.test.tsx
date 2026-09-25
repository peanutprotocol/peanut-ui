import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import esMessages from '@/i18n/app/messages/es-419.json'
import ptMessages from '@/i18n/app/messages/pt-BR.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { DepositAccountsListScreen } from '../components/DepositAccountsListScreen'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '../rails'
import { holdsSlot } from '../resolveScreen'
import type { ClaimableCorridor, DepositAccount, DepositCorridor, UnavailableCorridor } from '../types'
import type { GateState } from '@/utils/capability-gate'
import type { BankRowsInput } from '@/utils/unlock-payments.utils'
import { withReturnTo } from '@/utils/return-to.utils'

/** the hub the top-ups return to — the origin every top-up push carries */
const HUB_RETURN = '/add-money?method=bank'
const LIST = messages.depositAccounts.list

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))

const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
}))

// the country list is covered by its own tests; here it only has to hand a
// country back to the screen the way a tap does, and show the search it got
jest.mock('@/components/Common/CountryList', () => ({
    CountryList: (props: any) => (
        <div data-testid="country-list" data-search={props.searchTerm ?? 'own'}>
            <button
                data-testid="country-germany"
                data-supported={String(props.isCountrySupported({ type: 'country', iso2: 'DE', currency: 'EUR' }))}
                onClick={() => props.onCountryClick({ type: 'country', iso2: 'DE', currency: 'EUR', path: 'germany' })}
            >
                Germany
            </button>
        </div>
    ),
}))

const mockOpenCountry = jest.fn()
const mockIsCountrySupported = jest.fn(() => true)
jest.mock('../useDepositCountryRouting', () => ({
    useDepositCountryRouting: () => ({
        openCountry: mockOpenCountry,
        isCountrySupported: mockIsCountrySupported,
    }),
}))

let residenceIso2s: string[] = []
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => residenceIso2s }))

let depositAccountsEnabled = true
jest.mock('../useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

/** the bank rows Accounts and payments shows too, from the real builder */
const UNLOCK_ALL = { brl: 'unlock', ars: 'unlock', usd: 'unlock', mxn: 'unlock', sepa: 'unlock' } as const
let mockBankInput: BankRowsInput
jest.mock('@/hooks/useBankRows', () => ({
    useBankRows: () => ({
        rows: jest.requireActual('@/utils/unlock-payments.utils').buildBankRows(mockBankInput),
    }),
}))

beforeEach(() => {
    jest.clearAllMocks()
    depositAccountsEnabled = true
    residenceIso2s = []
    mockIsCountrySupported.mockReturnValue(true)
    mockBankInput = {
        bankChips: UNLOCK_ALL,
        restrictions: { banking: false, card: false },
        residenceIso2: 'BR',
        isEuropeResidence: false,
    }
})

const READY: GateState = { kind: 'ready' }

/** one gate for every corridor, the way a user with every rail enabled looks */
const allGates = (gate: GateState = READY): Record<DepositCorridor, GateState> => corridorRecord(() => gate)

const NONE = emptyCorridorRecord<DepositAccount>()

/** a corridor the user already holds, active and receiving money */
const heldAccount = (corridor: DepositCorridor): DepositAccount => ({
    id: `acct-${corridor}`,
    railId: `bridge.${corridor.toLowerCase()}`,
    country: 'DE',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Ana Pérez', iban: 'DE00', paymentRails: ['sepa'] },
})

const list = (
    isLoading: boolean,
    opts: {
        corridors?: DepositCorridor[]
        gates?: Record<DepositCorridor, GateState>
        isError?: boolean
        accounts?: Record<DepositCorridor, DepositAccount | undefined>
        claimable?: Partial<Record<DepositCorridor, ClaimableCorridor>>
        unavailable?: Partial<Record<DepositCorridor, UnavailableCorridor>>
        slotsHeld?: number
        accountLimit?: number
        onOpen?: (corridor: DepositCorridor) => void
        /** the hub reads `?method=` to decide whether crypto is still a question */
        searchParams?: string
    } = {}
) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={opts.searchParams ?? ''}>
                <DepositAccountsListScreen
                    corridors={opts.corridors ?? DEPOSIT_RAIL_ORDER}
                    accounts={opts.accounts ?? NONE}
                    claimable={{ ...emptyCorridorRecord<ClaimableCorridor>(), ...opts.claimable }}
                    unavailable={{ ...emptyCorridorRecord<UnavailableCorridor>(), ...opts.unavailable }}
                    slotsHeld={opts.slotsHeld ?? Object.values(opts.accounts ?? NONE).filter(holdsSlot).length}
                    accountLimit={opts.accountLimit}
                    gates={opts.gates ?? allGates()}
                    isLoading={isLoading}
                    isError={opts.isError ?? false}
                    onBack={() => {}}
                    onOpen={opts.onOpen ?? (() => {})}
                    onRetry={() => {}}
                />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )

/** a corridor the backend withholds from this user, and why */
const withheld = (corridor: DepositCorridor, reason: UnavailableCorridor['reason']): UnavailableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'CO',
    currency: 'COP',
    reason,
})

/** a corridor the backend offers this user, with the block it carries, if any */
const offered = (corridor: DepositCorridor, blockedBy?: ClaimableCorridor['blockedBy']): ClaimableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'CO',
    currency: 'COP',
    matching: { sender: 'unknown' },
    ...(blockedBy ? { blockedBy } : {}),
})

const rowOf = (container: HTMLElement, corridor: DepositCorridor) =>
    container.querySelector(`[data-testid="deposit-account-${corridor}"]`) as HTMLElement | null
const inRow = (container: HTMLElement, corridor: DepositCorridor) => within(rowOf(container, corridor) as HTMLElement)
const bankRow = (key: string) => screen.getByTestId(`bank-row-${key}`)

/** the account rows of one section, in the order the screen renders them */
const corridorsIn = (testId: string) =>
    Array.from(screen.getByTestId(testId).querySelectorAll('[data-testid^="deposit-account-"]'), (row) =>
        row.getAttribute('data-testid')!.replace('deposit-account-', '')
    )

const countriesTrigger = () => screen.getByTestId('other-countries-toggle')
/** the one row the accounts still to open fold into once the user holds one */
const unfoldOpenAccounts = () => fireEvent.click(screen.getByTestId('open-accounts-toggle'))
const search = (term: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: term } })
const drawer = () => within(screen.getByTestId('closed-row-drawer'))

/*
 * QA 2026-09-24 (QA-03/04/15): "Accounts" lists only the accounts the
 * user holds; the others sit under "Open new account". Aleks read MXN
 * under "Your account numbers" as his own.
 */
describe('the virtual accounts, held and to open', () => {
    it('lists held accounts under their own heading and the rest under "Open new account"', () => {
        list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), SPEI_MX: heldAccount('SPEI_MX') } })

        expect(screen.getByRole('heading', { name: LIST.heldTitle })).toBeInTheDocument()
        expect(corridorsIn('virtual-accounts')).toEqual(['SEPA_EU', 'SPEI_MX'])
        unfoldOpenAccounts()
        expect(corridorsIn('open-virtual-accounts')).toEqual(['FASTER_PAYMENTS_GB', 'ACH_US', 'BANK_TRANSFER_CO'])
    })

    it('has no held section while the user holds nothing', () => {
        list(false)

        expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: LIST.openTitle })).toBeInTheDocument()
    })

    // QA-16/05/23: the currency alone; the rail is named behind the tap
    it('titles each row by its currency alone, with no subtitle', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })
        unfoldOpenAccounts()

        expect(rowOf(container, 'SEPA_EU')).toHaveTextContent(/^EUR/)
        expect(rowOf(container, 'SEPA_EU')).not.toHaveTextContent('SEPA')
        expect(rowOf(container, 'ACH_US')).not.toHaveTextContent('ACH or wire')
        expect(bankRow('ars')).not.toHaveTextContent(/Mercado Pago|Bank transfer|One-off/)
        expect(bankRow('ars')).toHaveTextContent(/^ARS/)
    })

    // QA-22/47/11 and QA-24: one title, no pitch, no cap sentence
    it('carries no second heading, pitch or cap sentence, and keeps the counter', () => {
        list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), ACH_US: heldAccount('ACH_US') },
            claimable: { SPEI_MX: offered('SPEI_MX', 'account-limit') },
        })

        expect(screen.queryByText('How would you like to add money?')).not.toBeInTheDocument()
        expect(screen.queryByText(/Share them once/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Need another\? Contact support/)).not.toBeInTheDocument()
        expect(screen.getByTestId('account-counter')).toHaveTextContent('2 of 2 used')
    })

    it('opens a held account, revoked included, so support stays reachable', () => {
        const onOpen = jest.fn()
        const revoked = { ...heldAccount('ACH_US'), status: 'revoked' as const }
        const { container } = list(false, { accounts: { ...NONE, ACH_US: revoked }, onOpen })

        expect(inRow(container, 'ACH_US').getByText(LIST.badgeRevoked)).toBeInTheDocument()
        fireEvent.click(rowOf(container, 'ACH_US') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('ACH_US')
    })

    it('calls a held account Ready only when a payer can be handed it', () => {
        const retiring = { ...heldAccount('ACH_US'), status: 'retiring' as const }
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), ACH_US: retiring },
        })

        expect(inRow(container, 'SEPA_EU').getByText(LIST.badgeReady)).toBeInTheDocument()
        expect(inRow(container, 'ACH_US').getByText(LIST.badgeActive)).toBeInTheDocument()
    })
})

/*
 * Hugo, 2026-09-25: under a held account, a list of "Not set up" rows read as
 * a checklist, and working through it runs into the account limit. Once the
 * user holds one, the rest fold into one row; with none held they stay listed.
 */
describe('the accounts still to open fold once one is held', () => {
    it('lists them open while the user holds none', () => {
        const { container } = list(false)

        expect(screen.queryByTestId('open-accounts-toggle')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: LIST.openTitle })).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
    })

    it('folds them into one closed row once the user holds one, and lists them on a tap', () => {
        const onOpen = jest.fn()
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') }, onOpen })

        const toggle = screen.getByTestId('open-accounts-toggle')
        expect(toggle).toHaveTextContent(LIST.openTitle)
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        // the held account stays in view; only the ones to open fold
        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
        // the bank rows below do not fold with them
        expect(bankRow('ars')).toBeInTheDocument()

        unfoldOpenAccounts()
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(rowOf(container, 'ACH_US') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('ACH_US')
    })

    // Hugo, 2026-09-25: the fold is the last row of the held card, not a card of its own
    it('closes the held card with the fold, one outline and no doubled border', () => {
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), SPEI_MX: heldAccount('SPEI_MX') },
            accountLimit: 3,
        })

        const held = screen.getByTestId('virtual-accounts')
        const toggle = screen.getByTestId('open-accounts-toggle')
        expect(held).toContainElement(toggle)
        // the held rows and the fold item are siblings in one list
        const item = screen.getByTestId('open-accounts-item')
        expect(item).toContainElement(toggle)
        const heldList = rowOf(container, 'SEPA_EU')!.closest('.border')!.parentElement
        expect(item.parentElement).toBe(heldList)
        // the item is the card's foot: square top, no top border of its own
        expect(item).toHaveClass('rounded-b-sm', 'border-t-0')
        expect(heldList?.lastElementChild).toBe(item)

        unfoldOpenAccounts()
        // the rows inside sit under the line the content draws; none adds its own top border
        for (const corridor of corridorsIn('open-virtual-accounts')) {
            expect(rowOf(container, corridor as DepositCorridor)!.closest('.border')).toHaveClass('border-t-0')
        }
    })

    // nothing behind the fold can be opened at the limit; the counter says why
    // Hugo, 2026-09-25: the fold stays at the limit, and every row in it says why
    it('keeps the fold at the account limit, and every row in it explains the limit', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), SPEI_MX: heldAccount('SPEI_MX') },
            accountLimit: 2,
            claimable: { ACH_US: offered('ACH_US', 'account-limit') },
            gates: corridorRecord<GateState>((corridor) =>
                corridor === 'ACH_US' ? READY : { kind: 'needs-enrollment' }
            ),
            onOpen,
        })

        unfoldOpenAccounts()
        for (const corridor of ['FASTER_PAYMENTS_GB', 'ACH_US', 'BANK_TRANSFER_CO'] as const) {
            expect(inRow(container, corridor).getByText(LIST.badgeLimitReached)).toBeInTheDocument()
        }
        // a row the backend offers takes the claim step's own limit screen
        fireEvent.click(rowOf(container, 'ACH_US') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('ACH_US')
        // a row with no rail explains the limit in place
        fireEvent.click(rowOf(container, 'FASTER_PAYMENTS_GB') as HTMLElement)
        expect(drawer().getByText('2 accounts already open')).toBeInTheDocument()
        expect(drawer().getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
    })

    it('explains an account with no rail where the user lives, with the way to change it', () => {
        residenceIso2s = ['PT']
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
            gates: corridorRecord<GateState>((corridor) =>
                corridor === 'SEPA_EU' ? READY : { kind: 'needs-enrollment' }
            ),
        })

        unfoldOpenAccounts()
        expect(inRow(container, 'FASTER_PAYMENTS_GB').getByText(LIST.badgeNotOffered)).toBeInTheDocument()
        fireEvent.click(rowOf(container, 'FASTER_PAYMENTS_GB') as HTMLElement)
        expect(drawer().getByText('We cannot open a GBP account')).toBeInTheDocument()
        expect(drawer().getByText(messages.depositAccounts.errors.residenceRestricted)).toBeInTheDocument()
        expect(drawer().getByRole('button', { name: 'Update residence' })).toBeInTheDocument()
    })

    it('asks for a residence where none is set', () => {
        residenceIso2s = []
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') },
            gates: corridorRecord<GateState>((corridor) =>
                corridor === 'SEPA_EU' ? READY : { kind: 'needs-enrollment' }
            ),
        })

        unfoldOpenAccounts()
        fireEvent.click(rowOf(container, 'SPEI_MX') as HTMLElement)
        expect(drawer().getByText('Residence not set')).toBeInTheDocument()
        expect(
            drawer().getByText('MXN accounts depend on where you live. Set a residence to check.')
        ).toBeInTheDocument()
        expect(drawer().getByRole('button', { name: 'Update residence' })).toBeInTheDocument()
    })

    it('folds under a revoked account too, which still sits in the held list', () => {
        const revoked = { ...heldAccount('ACH_US'), status: 'revoked' as const }
        list(false, { accounts: { ...NONE, ACH_US: revoked } })

        expect(screen.getByTestId('open-accounts-toggle')).toBeInTheDocument()
    })

    it('lists every match while a search runs, and folds back when it clears', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        search('usd')
        expect(screen.queryByTestId('open-accounts-toggle')).not.toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).toBeInTheDocument()

        search('')
        expect(screen.getByTestId('open-accounts-toggle')).toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
    })
})

describe('an account the user could open', () => {
    it('says Not set up where a tap opens it', () => {
        const onOpen = jest.fn()
        const { container } = list(false, { claimable: { SEPA_EU: offered('SEPA_EU') }, onOpen })

        expect(inRow(container, 'SEPA_EU').getByText(LIST.badgeNotSetUp)).toHaveClass('bg-background-badge-helper')
        fireEvent.click(rowOf(container, 'SEPA_EU') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('SEPA_EU')
    })

    it.each([['needs-identity'], ['fixable-rejection'], ['restart-identity']] as const)(
        'names verification and leads to it when the gate reads %s',
        (kind) => {
            const onOpen = jest.fn()
            const { container } = list(false, {
                corridors: ['SEPA_EU'],
                gates: allGates({ kind, userMessage: null } as GateState),
                onOpen,
            })

            expect(inRow(container, 'SEPA_EU').getByText(LIST.badgeVerify)).toBeInTheDocument()
            fireEvent.click(rowOf(container, 'SEPA_EU') as HTMLElement)
            expect(onOpen).toHaveBeenCalledWith('SEPA_EU')
        }
    )

    /*
     * At the account limit the tap explains the limit and offers support (the
     * gate drawer behind `onOpen`). The row no longer reads "Available", which
     * under "Open new account" promised an account the user cannot open.
     */
    it('says the limit is reached, and leads to the drawer that explains it', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU'), ACH_US: heldAccount('ACH_US') },
            claimable: { SPEI_MX: offered('SPEI_MX', 'account-limit') },
            onOpen,
        })
        // at the limit there is no fold; a search still finds the row
        search('mxn')

        expect(inRow(container, 'SPEI_MX').getByText(LIST.badgeLimitReached)).toBeInTheDocument()
        expect(inRow(container, 'SPEI_MX').queryByText('Available')).not.toBeInTheDocument()
        fireEvent.click(rowOf(container, 'SPEI_MX') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('SPEI_MX')
    })

    it('shows a provider review in progress, and one that waits on the user', () => {
        const { container } = list(false, {
            gates: { ...allGates(), BANK_TRANSFER_CO: { kind: 'pending' }, SPEI_MX: { kind: 'pending' } },
            claimable: {
                BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'endorsement-pending'),
                SPEI_MX: offered('SPEI_MX', 'endorsement-required'),
            },
        })

        expect(inRow(container, 'BANK_TRANSFER_CO').getByText('Pending')).toBeInTheDocument()
        expect(inRow(container, 'SPEI_MX').getByText(LIST.badgeActionNeeded)).toBeInTheDocument()
    })

    it('points at support where the backend says only a person can open it', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            unavailable: { BANK_TRANSFER_CO: withheld('BANK_TRANSFER_CO', 'support-required') },
            onOpen,
        })

        expect(inRow(container, 'BANK_TRANSFER_CO').getByText(/contact support/i)).toBeInTheDocument()
        fireEvent.click(rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('BANK_TRANSFER_CO')
    })
})

/*
 * QA-20/46: a rail the user cannot use stays visible, sorts last, and a tap
 * says why — never a grey row that does nothing (Kush's COP · Bre-B row).
 */
describe('a row the user cannot use', () => {
    it('sorts a withheld account last, reads Not available, and explains itself with a way to support', () => {
        const onOpen = jest.fn()
        const { container } = list(false, {
            unavailable: { FASTER_PAYMENTS_GB: withheld('FASTER_PAYMENTS_GB', 'not-offered') },
            onOpen,
        })

        expect(corridorsIn('open-virtual-accounts').at(-1)).toBe('FASTER_PAYMENTS_GB')
        const row = rowOf(container, 'FASTER_PAYMENTS_GB') as HTMLElement
        expect(within(row).getByText(LIST.badgeNotOffered)).toBeInTheDocument()
        expect(row).not.toHaveAttribute('aria-disabled')

        fireEvent.click(row)
        expect(onOpen).not.toHaveBeenCalled()
        expect(drawer().getByText(LIST.notOfferedBody.replace('{currency}', 'GBP'))).toBeInTheDocument()
        // the body names the currency; no "GBP · Faster Payments" caption under the button (Hugo QA 2026-09-25)
        expect(drawer().queryByText('GBP · Faster Payments')).not.toBeInTheDocument()
        expect(drawer().queryByText(/Faster Payments/)).not.toBeInTheDocument()

        jest.useFakeTimers()
        fireEvent.click(drawer().getByRole('button', { name: messages.common.contactSupport }))
        jest.runAllTimers()
        jest.useRealTimers()
        expect(mockOpenSupport).toHaveBeenCalledWith(expect.stringContaining('FASTER_PAYMENTS_GB'))
    })

    // Kush's staging row: a stale rejected Bre-B rail left the gate at blocked-rejection
    it('explains a corridor whose gate only a person can lift, where it used to say "Not set up" and do nothing', () => {
        const { container } = list(false, {
            gates: { ...allGates(), BANK_TRANSFER_CO: { kind: 'blocked-rejection', userMessage: null } },
            claimable: { BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO') },
        })

        const row = rowOf(container, 'BANK_TRANSFER_CO') as HTMLElement
        expect(within(row).getByText(LIST.badgeNotOffered)).toBeInTheDocument()
        expect(within(row).queryByText(LIST.badgeNotSetUp)).not.toBeInTheDocument()
        fireEvent.click(row)
        expect(drawer().getByText(LIST.notOfferedBody.replace('{currency}', 'COP'))).toBeInTheDocument()
    })

    it('keeps a residence-gated bank row, last, and says which residence it needs, with the way to change it', () => {
        mockBankInput = { ...mockBankInput, residenceIso2: 'PT', isEuropeResidence: true }
        list(false)

        const keys = Array.from(
            screen.getByTestId('other-ways').querySelectorAll('[data-testid^="bank-row-"]'),
            (row) => row.getAttribute('data-testid')
        )
        expect(keys.slice(-2)).toEqual(['bank-row-brl', 'bank-row-ars'])
        expect(within(bankRow('ars')).getByText('Not available')).toBeInTheDocument()

        fireEvent.click(bankRow('ars'))
        const corridor = messages.depositAccounts.corridors.BANK_TRANSFER_AR
        expect(drawer().getByText(corridor.residenceTitle)).toBeInTheDocument()
        expect(drawer().getByText(new RegExp(corridor.residenceRequired.slice(0, 30)))).toBeInTheDocument()

        jest.useFakeTimers()
        fireEvent.click(drawer().getByRole('button', { name: messages.depositAccounts.details.residenceCta }))
        jest.runAllTimers()
        jest.useRealTimers()
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/profile/accounts?open=residence', HUB_RETURN))
    })

    it('says bank transfers are closed where the country of residence closes them all', () => {
        mockBankInput = { ...mockBankInput, restrictions: { banking: true, card: false } }
        list(false)

        fireEvent.click(bankRow('usd'))
        expect(drawer().getByText(messages.profile.unlockPayments.bankNotAvailableNote)).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

/*
 * QA-17 and QA-18: the bank rows Accounts and payments lists sit here too,
 * under one heading that sets them apart from virtual accounts.
 */
describe('the other ways in', () => {
    it('names them apart from virtual accounts, in the order and with the status the other screen shows', () => {
        mockBankInput = { ...mockBankInput, bankChips: { ...UNLOCK_ALL, brl: 'active' } }
        list(false)

        const section = within(screen.getByTestId('other-ways'))
        expect(section.getByRole('heading', { name: LIST.otherWaysTitle })).toBeInTheDocument()
        expect(section.getByText(LIST.otherWaysBody)).toBeInTheDocument()
        expect(within(bankRow('brl')).getByText('Available')).toBeInTheDocument()
        expect(within(bankRow('usd')).getByText('Unlock')).toBeInTheDocument()
    })

    it('opens the transfer the user sends themselves, with the way back to this screen', () => {
        list(false)

        fireEvent.click(bankRow('brl'))
        expect(mockPush).toHaveBeenCalledWith(withReturnTo('/add-money/brazil/manteca', HUB_RETURN))
    })

    it('drops the bank row an active virtual account already covers', () => {
        mockBankInput = { ...mockBankInput, bankChips: { ...UNLOCK_ALL, sepa: 'active' } }
        list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        expect(screen.queryByTestId('bank-row-sepa')).not.toBeInTheDocument()
    })

    it('holds the bank rows behind skeletons until the accounts load, so the deduped list does not jump', () => {
        list(true)

        expect(screen.queryByTestId('bank-row-brl')).not.toBeInTheDocument()
        expect(screen.queryByTestId('virtual-accounts')).not.toBeInTheDocument()
        expect(screen.queryByText(LIST.badgeNotSetUp)).not.toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
    })
})

/*
 * QA-07: every country stays in the picker, and the one search field filters
 * the rows above it as well.
 */
describe('the search', () => {
    it('filters the virtual accounts and the bank rows, and opens the countries on the same term', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        search('brazil')

        expect(rowOf(container, 'SEPA_EU')).not.toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
        expect(bankRow('brl')).toBeInTheDocument()
        expect(screen.queryByTestId('bank-row-usd')).not.toBeInTheDocument()
        expect(screen.getByTestId('country-list')).toHaveAttribute('data-search', 'brazil')
    })

    it('finds an account by a country it serves', () => {
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') } })

        search('germany')

        expect(rowOf(container, 'SEPA_EU')).toBeInTheDocument()
        expect(rowOf(container, 'ACH_US')).not.toBeInTheDocument()
    })

    it('is the only search field: the country list takes its term', () => {
        list(false)

        expect(screen.getAllByRole('textbox')).toHaveLength(1)
        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-list')).toHaveAttribute('data-search', '')
    })
})

describe('crypto and the countries', () => {
    it('drops crypto where the hub was entered as the bank answer', () => {
        list(false, { searchParams: '?method=bank' })

        expect(screen.queryByTestId('add-money-crypto')).not.toBeInTheDocument()
    })

    it('opens the crypto flow from its own row on any other way in', () => {
        list(false)

        fireEvent.click(screen.getByTestId('add-money-crypto'))
        expect(mockPush).toHaveBeenCalledWith('/add-money/crypto')
    })

    it('keeps the countries folded until asked, and hands a pick to the one resolver', () => {
        list(false)

        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()

        fireEvent.click(countriesTrigger())
        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(screen.getByTestId('country-germany'))
        expect(mockOpenCountry).toHaveBeenCalledWith(expect.objectContaining({ iso2: 'DE', path: 'germany' }))
    })

    it('folds the countries again on a second tap', () => {
        list(false)

        fireEvent.click(countriesTrigger())
        fireEvent.click(countriesTrigger())
        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
    })

    it('opens the countries on a search without the row, and folds them back when the search clears', () => {
        list(false)

        search('germ')
        expect(screen.queryByTestId('other-countries-toggle')).not.toBeInTheDocument()
        expect(screen.getByTestId('country-list')).toHaveAttribute('data-search', 'germ')

        search('')
        expect(countriesTrigger()).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByTestId('country-list')).not.toBeInTheDocument()
    })

    it('marks a country with nothing behind it unsupported, so the list offers the waitlist', () => {
        mockIsCountrySupported.mockReturnValue(false)
        list(false)

        fireEvent.click(countriesTrigger())
        expect(screen.getByTestId('country-germany')).toHaveAttribute('data-supported', 'false')
    })
})

describe('the account counter', () => {
    const counter = (used: number, cap: number) =>
        LIST.accountCounter.replace('{used}', String(used)).replace('{cap}', String(cap))
    const holding = { ...NONE, SEPA_EU: heldAccount('SEPA_EU') }

    it('sits beside the held heading, not inside it, with the reason one tap away', () => {
        list(false, { accounts: holding })

        const heading = screen.getByRole('heading', { name: LIST.heldTitle })
        expect(heading.contains(screen.getByTestId('account-counter'))).toBe(false)
        expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(1, 2))
        fireEvent.click(
            within(screen.getByTestId('account-counter')).getByRole('button', { name: LIST.accountLimitWhyLabel })
        )
        expect(screen.getByText(LIST.accountLimitWhy)).toBeInTheDocument()
    })

    it('states the limit the backend sends, raised or not', () => {
        list(false, { accounts: holding, slotsHeld: 2, accountLimit: 5 })

        expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(2, 5))
    })

    it('uses the limit support raised, read off the block, when the backend sends no number', () => {
        list(false, { accounts: holding, slotsHeld: 3, claimable: { SPEI_MX: offered('SPEI_MX', 'account-limit') } })

        expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(3, 3))
    })

    it('shows no number for a raised limit it cannot read', () => {
        list(false, { accounts: holding, slotsHeld: 2, claimable: { SPEI_MX: offered('SPEI_MX') } })

        expect(screen.queryByTestId('account-counter')).not.toBeInTheDocument()
    })

    it('does not count a revoked account, which takes no slot', () => {
        list(false, {
            accounts: { ...holding, ACH_US: { ...heldAccount('ACH_US'), status: 'revoked' } },
        })

        expect(screen.getByTestId('account-counter')).toHaveTextContent(counter(1, 2))
    })

    it('is gone while opening accounts is dark', () => {
        depositAccountsEnabled = false
        list(false, { accounts: holding, accountLimit: 2 })

        expect(screen.queryByTestId('account-counter')).not.toBeInTheDocument()
    })
})

/*
 * The flag is the rollback lever. Turning it off must not hide bank details a
 * user already handed out: money keeps landing on them.
 */
describe('while opening accounts is dark', () => {
    it('keeps held accounts readable, offers none to open, and keeps the other ways', () => {
        depositAccountsEnabled = false
        const onOpen = jest.fn()
        const { container } = list(false, { accounts: { ...NONE, SEPA_EU: heldAccount('SEPA_EU') }, onOpen })

        expect(screen.queryByTestId('open-virtual-accounts')).not.toBeInTheDocument()
        fireEvent.click(rowOf(container, 'SEPA_EU') as HTMLElement)
        expect(onOpen).toHaveBeenCalledWith('SEPA_EU')
        expect(bankRow('brl')).toBeInTheDocument()
        expect(countriesTrigger()).toBeInTheDocument()
    })
})

/**
 * A read that failed is not "you hold nothing". Rendering the empty fallback
 * map as unclaimed corridors invites a user to open an account they may
 * already have.
 */
describe('when the accounts cannot be read', () => {
    it('says so, offers a retry, and claims nothing about any corridor', () => {
        const { container } = list(false, { isError: true })

        expect(screen.getByText(LIST.errorTitle)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
        expect(rowOf(container, 'SEPA_EU')).toHaveAttribute('aria-disabled', 'true')
        expect(inRow(container, 'SEPA_EU').queryByText(LIST.badgeNotSetUp)).not.toBeInTheDocument()
    })
})

/**
 * Which screen is right depends on a network answer. Before it arrives, a
 * missing account is indistinguishable from one that was never claimed — so
 * the flow must not offer to open an account the user may already hold.
 */
describe('DepositAccountsFlow while the accounts are loading', () => {
    const flow = (isLoading: boolean, gates: Record<DepositCorridor, GateState> = allGates(), isError = false) =>
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=details&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={gates}
                        isLoading={isLoading}
                        isError={isError}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

    it('shows neither claim nor details until it knows which is true', () => {
        flow(true)
        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
    })

    it('offers to open the account once it knows there is none', () => {
        flow(false)
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })

    // A hand-edited `?corridor=` must not borrow a sibling corridor's gate.
    it('refuses the claim step when the SELECTED corridor is blocked', () => {
        const gates = allGates({ kind: 'needs-enrollment' })
        gates.ACH_US = READY
        flow(false, gates)
        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
    })
})

describe('DepositAccountsFlow when the accounts cannot be read', () => {
    it('falls back to the list and its retry rather than offering the claim', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=claim&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={allGates()}
                        isLoading={false}
                        isError
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

        expect(screen.queryByRole('button', { name: /open eur account/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
})

/**
 * `?corridor=` is a user input like any other. A link minted for a corridor the
 * user has no rail for has to land somewhere true.
 */
describe('DepositAccountsFlow when a link names a corridor the user has no rail for', () => {
    it('lands an Argentine link on the list, which points at the Argentine flow', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?step=details&corridor=BANK_TRANSFER_AR">
                    <DepositAccountsFlow
                        corridors={['SEPA_EU']}
                        accounts={NONE}
                        gates={allGates()}
                        isLoading={false}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )

        expect(
            screen.queryByText(messages.depositAccounts.details.unavailableTitle.replace('{currency}', 'ARS'))
        ).not.toBeInTheDocument()
        expect(screen.getByText(LIST.addTitle)).toBeInTheDocument()
        expect(bankRow('ars')).toBeInTheDocument()
    })
})

/**
 * The cursor shipped as `?screen=` and was renamed to `?step=`, the name every
 * other flow in the app uses. Links already minted must still land.
 */
describe('DepositAccountsFlow accepts the cursor by its old name', () => {
    it('opens the step a `?screen=` link asked for', () => {
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams="?screen=claim&corridor=SEPA_EU">
                    <DepositAccountsFlow
                        corridors={DEPOSIT_RAIL_ORDER}
                        accounts={NONE}
                        gates={allGates()}
                        userName="Demo User"
                        onExit={() => {}}
                        onClaim={() => {}}
                        onResolveGate={() => {}}
                        onRetry={() => {}}
                        onContactSupport={() => {}}
                    />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )
        expect(screen.getByRole('button', { name: /open eur account/i })).toBeInTheDocument()
    })
})

/**
 * Four catalogs ship this screen. A key that exists only in English reaches a
 * Spanish user as its own raw name.
 */
describe('the hub copy exists in every catalog', () => {
    const HUB_KEYS = [
        'addTitle',
        'heldTitle',
        'openTitle',
        'otherWaysTitle',
        'otherWaysBody',
        'badgeLimitReached',
        'notOfferedBody',
        'countriesTitle',
        'countriesPitch',
    ]

    it('es-419 and pt-BR carry every key the hub reads', () => {
        for (const catalog of [esMessages, ptMessages]) {
            const listCopy = (catalog as any).depositAccounts.list
            for (const key of HUB_KEYS) expect(listCopy[key]).toBeTruthy()
        }
    })
})
