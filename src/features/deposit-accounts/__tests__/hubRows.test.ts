import type { GateState } from '@/utils/capability-gate'
import { buildBankRows, type UnlockRow } from '@/utils/unlock-payments.utils'
import { closedBankRow, corridorMatchesSearch, otherWaysRows, virtualAccountRows } from '../hubRows'
import { corridorRecord, DEPOSIT_RAIL_ORDER, emptyCorridorRecord } from '../rails'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor, UnavailableCorridor } from '../types'

const READY: GateState = { kind: 'ready' }
const gatesAll = (gate: GateState = READY) => corridorRecord(() => gate)

const held = (corridor: DepositCorridor, status: DepositAccountView['status'] = 'active'): DepositAccountView => ({
    id: `acct-${corridor}`,
    railId: `bridge.${corridor.toLowerCase()}`,
    country: 'DE',
    currency: 'EUR',
    status,
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'anyone' },
})

const input = (over: {
    corridors?: DepositCorridor[]
    accounts?: Partial<Record<DepositCorridor, DepositAccountView>>
    claimable?: Partial<Record<DepositCorridor, ClaimableCorridor>>
    unavailable?: Partial<Record<DepositCorridor, UnavailableCorridor>>
    gates?: Record<DepositCorridor, GateState>
}) => ({
    corridors: over.corridors ?? DEPOSIT_RAIL_ORDER,
    accounts: { ...emptyCorridorRecord<DepositAccountView>(), ...over.accounts },
    claimable: { ...emptyCorridorRecord<ClaimableCorridor>(), ...over.claimable },
    unavailable: { ...emptyCorridorRecord<UnavailableCorridor>(), ...over.unavailable },
    gates: over.gates ?? gatesAll(),
})

const notOffered = (corridor: DepositCorridor): UnavailableCorridor => ({
    railId: `bridge.${corridor.toLowerCase()}`,
    method: corridor,
    country: 'CO',
    currency: 'COP',
    reason: 'not-offered',
})

/**
 * QA 2026-09-24 (QA-03/04/15): "Virtual accounts" lists only accounts the user
 * holds. The rest sit under "Open a virtual account".
 */
describe('virtualAccountRows', () => {
    it('lists held accounts apart from the ones the user could open, one-off transfers in neither', () => {
        const { held: heldRows, open } = virtualAccountRows(
            input({ accounts: { SEPA_EU: held('SEPA_EU'), SPEI_MX: held('SPEI_MX', 'revoked') } }),
            true
        )

        expect(heldRows).toEqual(['SEPA_EU', 'SPEI_MX'])
        expect(open.map((row) => row.corridor)).toEqual(['FASTER_PAYMENTS_GB', 'ACH_US', 'BANK_TRANSFER_CO'])
    })

    it('offers nothing to open while the rollout flag is off, and keeps the held accounts readable', () => {
        const { held: heldRows, open } = virtualAccountRows(input({ accounts: { SEPA_EU: held('SEPA_EU') } }), false)

        expect(heldRows).toEqual(['SEPA_EU'])
        expect(open).toEqual([])
    })

    it('offers no account for a corridor the user has no rail for', () => {
        const { open } = virtualAccountRows(input({ corridors: ['SEPA_EU'] }), true)

        expect(open.map((row) => row.corridor)).toEqual(['SEPA_EU'])
    })

    // "always have grey items at bottom" (Hugo)
    it('sorts a row that can only explain itself last, catalogue order kept inside each group', () => {
        const { open } = virtualAccountRows(
            input({ unavailable: { FASTER_PAYMENTS_GB: notOffered('FASTER_PAYMENTS_GB') } }),
            true
        )

        expect(open.map((row) => [row.corridor, row.openable])).toEqual([
            ['SEPA_EU', true],
            ['ACH_US', true],
            ['SPEI_MX', true],
            ['BANK_TRANSFER_CO', true],
            ['FASTER_PAYMENTS_GB', false],
        ])
    })

    /*
     * Kush's COP row on staging (2026-09-24): a stale REJECTED Bre-B rail made
     * the gate read `blocked-rejection`, so the row could not be opened. It is
     * closed, and the tap explains why.
     */
    it('closes a row whose gate only a person can lift, with no backend reason', () => {
        const gates = { ...gatesAll(), BANK_TRANSFER_CO: { kind: 'blocked-rejection', userMessage: null } as GateState }
        const { open } = virtualAccountRows(input({ gates }), true)

        expect(open.find((row) => row.corridor === 'BANK_TRANSFER_CO')?.openable).toBe(false)
    })

    it('keeps rows open where the tap leads to verification, a provider review or the account limit', () => {
        const gates = { ...gatesAll(), SEPA_EU: { kind: 'needs-identity' } as GateState }
        const offered = (corridor: DepositCorridor, blockedBy: ClaimableCorridor['blockedBy']): ClaimableCorridor => ({
            railId: `bridge.${corridor.toLowerCase()}`,
            method: corridor,
            country: 'CO',
            currency: 'COP',
            matching: { sender: 'unknown' },
            blockedBy,
        })
        const { open } = virtualAccountRows(
            input({
                gates,
                claimable: {
                    SPEI_MX: offered('SPEI_MX', 'account-limit'),
                    BANK_TRANSFER_CO: offered('BANK_TRANSFER_CO', 'endorsement-required'),
                },
            }),
            true
        )

        expect(open.every((row) => row.openable)).toBe(true)
    })
})

describe('otherWaysRows', () => {
    const rows = buildBankRows({
        bankChips: { brl: 'active', ars: 'unlock', usd: 'active', mxn: 'unlock', sepa: 'active' },
        restrictions: { banking: false, card: false },
        residenceIso2: 'PT',
        isEuropeResidence: true,
    })

    it('drops the bank row an active virtual account covers, and sorts rows the user cannot use last', () => {
        // PT: BRL keeps its active rail, ARS is residence-gated
        expect(otherWaysRows(rows, new Set(['EUR'])).map((row) => [row.labelKey, row.chip])).toEqual([
            ['brl', 'active'],
            ['usd', 'active'],
            ['mxn', 'unlock'],
            ['ars', 'notAvailable'],
        ])
    })
})

describe('closedBankRow', () => {
    const row = (over: Partial<UnlockRow>): UnlockRow => ({
        id: 'ars-bank',
        labelKey: 'ars',
        concept: 'bank',
        chip: 'unlock',
        corridor: 'BANK_TRANSFER_AR',
        regionPath: 'latam',
        ...over,
    })

    it('names the residence the Argentine and Brazilian rows need', () => {
        expect(closedBankRow(row({ chip: 'notAvailable', unavailableBecause: 'residence' }), false, 'ARS')).toEqual({
            kind: 'residence',
            corridor: 'BANK_TRANSFER_AR',
            label: 'ARS',
        })
    })

    it('names the country rule where bank transfers are closed for every rail', () => {
        expect(
            closedBankRow(row({ chip: 'notAvailable', unavailableBecause: 'restricted-country' }), false, 'ARS')
        ).toEqual({ kind: 'restricted-country', label: 'ARS' })
    })

    it('explains a verification outage on a row that needs verification, and leaves a working row alone', () => {
        expect(closedBankRow(row({}), true, 'ARS')).toEqual({ kind: 'verification-down', label: 'ARS' })
        expect(closedBankRow(row({ chip: 'active' }), true, 'ARS')).toBeNull()
        expect(closedBankRow(row({}), false, 'ARS')).toBeNull()
    })
})

/** QA-07: the search filters the rows above the countries too. */
describe('corridorMatchesSearch', () => {
    it.each([
        ['eur', 'SEPA_EU'],
        ['euro', 'SEPA_EU'],
        ['germany', 'SEPA_EU'],
        ['sepa', 'SEPA_EU'],
        ['pix', 'PIX_BR'],
        ['brazil', 'PIX_BR'],
        ['mexi', 'SPEI_MX'],
    ] as const)('"%s" finds %s', (term, corridor) => {
        const railName = { SEPA_EU: 'SEPA', PIX_BR: 'Pix', SPEI_MX: 'SPEI' }[corridor]
        expect(corridorMatchesSearch(corridor, term, 'en', railName)).toBe(true)
    })

    it('finds a country by its name in the reader language', () => {
        expect(corridorMatchesSearch('SEPA_EU', 'alemanha', 'pt-BR', 'SEPA')).toBe(true)
    })

    it('leaves out a row the term does not name, and keeps every row for an empty term', () => {
        expect(corridorMatchesSearch('ACH_US', 'brazil', 'en', 'ACH or wire')).toBe(false)
        expect(corridorMatchesSearch('ACH_US', '  ', 'en', 'ACH or wire')).toBe(true)
    })
})
