import { corridorHasTopUp } from './countryRoutes'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'

export type AddMoneyMethod = 'account' | 'bank' | 'pix' | 'ars' | 'crypto' | 'more'

/**
 * Where the Pix row stands on both Add lists, Home's drawer and the Add picker, read from the API's Pix
 * deposit route, never from a list of countries (the owner, 15 Nov):
 * - `first`: the route offers Pix on Avenia (`pixDepositOffered`): Pix leads (ruling of 12 Nov).
 * - `after-bank`: a Pix top-up already ready (a Manteca account set up before), or a resident of Brazil
 *   whose route is open and not paused, who can start Pix from the row.
 * - null: everyone else, among them a user who lives outside Brazil, a refused route, the Brazil pause
 *   and a user with no residence on file.
 */
function pixRowPlace(input: {
    pixDepositOffered?: boolean
    pixDepositRouteOpen?: boolean
    residenceIso2s: readonly string[]
    pixReady: boolean
}): 'first' | 'after-bank' | null {
    if (input.pixDepositOffered) return 'first'
    if (input.pixReady) return 'after-bank'
    if (input.residenceIso2s.includes('BR') && input.pixDepositRouteOpen) return 'after-bank'
    return null
}

/**
 * Whether both Add lists lead with the ARS row (the owner, 24 Nov), as Pix leads on Avenia. The API
 * sends no route for the peso top-up, so its own gate decides: a ready top-up, or a resident of
 * Argentina whose gate the provider has not refused. A step still open (verification, set-up, review)
 * keeps the row, because the flow takes the user through it. A Manteca outage keeps it too: the page
 * shows the outage. Nobody outside Argentina gets the row.
 */
export function arsRowShown(input: {
    arsTopUpOpen?: boolean
    residenceIso2s: readonly string[]
    arsReady: boolean
}): boolean {
    if (input.arsReady) return true
    return !!input.arsTopUpOpen && residenceAllows('BANK_TRANSFER_AR', [...input.residenceIso2s])
}

export function resolveAddMoneyMethods(input: {
    cryptoReady: boolean
    standingEnabled: boolean
    brazilPaused: boolean
    residenceIso2s: readonly string[]
    activeAccounts: readonly string[]
    readyTopUps: readonly string[]
    firstPaymentAt?: string | null
    /** The Pix deposit route is Avenia's, not refused and not under the Brazil pause (`pixDepositOffered`). */
    pixDepositOffered?: boolean
    /** The Pix deposit route is sent, and neither refused nor paused. */
    pixDepositRouteOpen?: boolean
    /** The peso top-up's gate has loaded and is not refused (`topUpGates.BANK_TRANSFER_AR`). */
    arsTopUpOpen?: boolean
}) {
    const ready = {
        account: [] as string[],
        transfer: [] as string[],
        pix: [] as string[],
        ars: [] as string[],
    }
    for (const corridor of DEPOSIT_RAIL_ORDER) {
        const rail = DEPOSIT_RAILS[corridor]
        if (isClaimable(rail) && input.activeAccounts.includes(rail.currency)) ready.account.push(rail.currency)
        if (!input.readyTopUps.includes(rail.currency) || !corridorHasTopUp(corridor)) continue
        if (!residenceAllows(corridor, [...input.residenceIso2s])) continue
        if (corridor === 'PIX_BR') {
            if (!input.brazilPaused) ready.pix.push(rail.currency)
        } else if (corridor === 'BANK_TRANSFER_AR') ready.ars.push(rail.currency)
        else ready.transfer.push(rail.currency)
    }
    // An offered Avenia route is also offered to a user who has not verified yet, so it never makes them
    // returning; nor does an open peso gate.
    const returning =
        !!input.firstPaymentAt ||
        !!(ready.account.length || ready.transfer.length || ready.pix.length || ready.ars.length)
    if (input.pixDepositOffered && !input.brazilPaused && !ready.pix.includes('BRL')) ready.pix.push('BRL')
    const pixRow = pixRowPlace({ ...input, pixReady: ready.pix.length > 0 })
    const arsRow = arsRowShown({ ...input, arsReady: ready.ars.length > 0 })
    const drawerMethods: AddMoneyMethod[] = []
    // Bank accounts show wherever the user can hold or open one (the owner, 15 Nov), as on the picker:
    // the row alone never moves a user to the drawer, which still needs something ready or a payment.
    const accountsOffered = input.standingEnabled || ready.account.length > 0
    if (arsRow) drawerMethods.push('ars')
    if (pixRow === 'first') drawerMethods.push('pix')
    if (accountsOffered) drawerMethods.push('account')
    // A one-time bank transfer is never a drawer row (the owner, 15 Nov): the picker's bank row, behind
    // "More ways to add money", reaches it. A ready one still makes the user returning.
    if (pixRow === 'after-bank') drawerMethods.push('pix')
    if (input.cryptoReady) drawerMethods.push('crypto')
    const usable = drawerMethods.length > 0
    if (usable && returning) drawerMethods.push('more')
    const pickerMethods: AddMoneyMethod[] = []
    if (arsRow) pickerMethods.push('ars')
    if (pixRow === 'first') pickerMethods.push('pix')
    // One bank row for everybody (the owner, 25 Nov, Release 170.2): it opens the bank hub, where a
    // country leads to the reusable account when the user holds or can open one, else to the one-time
    // transfer (`useDepositCountryRouting`). The user never chooses between the two by name.
    pickerMethods.push('bank')
    if (pixRow === 'after-bank') pickerMethods.push('pix')
    pickerMethods.push('crypto')
    return {
        entry: usable && returning ? ('drawer' as const) : ('picker' as const),
        ready,
        drawerMethods,
        pickerMethods,
    }
}
