import { corridorHasTopUp } from './countryRoutes'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS, isClaimable } from '@/features/deposit-accounts/rails'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'

export type AddMoneyMethod = 'account' | 'transfer' | 'pix' | 'crypto' | 'more'

export function resolveAddMoneyMethods(input: {
    cryptoReady: boolean
    standingEnabled: boolean
    brazilPaused: boolean
    residenceIso2s: readonly string[]
    activeAccounts: readonly string[]
    readyTopUps: readonly string[]
    firstPaymentAt?: string | null
    /** The API sent a Pix deposit route and did not refuse it (`pixRouteOpen`), whichever provider serves it. */
    pixRouteOpen?: boolean
}) {
    const ready = { account: [] as string[], transfer: [] as string[], pix: [] as string[] }
    for (const corridor of DEPOSIT_RAIL_ORDER) {
        const rail = DEPOSIT_RAILS[corridor]
        if (isClaimable(rail) && input.activeAccounts.includes(rail.currency)) ready.account.push(rail.currency)
        if (!input.readyTopUps.includes(rail.currency) || !corridorHasTopUp(corridor)) continue
        if (!residenceAllows(corridor, [...input.residenceIso2s])) continue
        if (corridor === 'PIX_BR') {
            if (!input.brazilPaused) ready.pix.push(rail.currency)
        } else ready.transfer.push(rail.currency)
    }
    if (input.pixRouteOpen && !input.brazilPaused && !ready.pix.includes('BRL')) ready.pix.push('BRL')
    const drawerMethods: AddMoneyMethod[] = []
    // Pix leads for a user who can pay in by Pix (Aleks, 2026-11-12)
    if (ready.pix.length) drawerMethods.push('pix')
    if (ready.account.length) drawerMethods.push('account')
    if (ready.transfer.length) drawerMethods.push('transfer')
    if (input.cryptoReady) drawerMethods.push('crypto')
    const usable = drawerMethods.length > 0
    const returning = !!input.firstPaymentAt || !!(ready.account.length || ready.transfer.length || ready.pix.length)
    if (usable && returning) drawerMethods.push('more')
    const pickerMethods: AddMoneyMethod[] = []
    if (input.standingEnabled || ready.account.length) pickerMethods.push('account')
    pickerMethods.push('transfer', 'pix', 'crypto')
    return {
        entry: usable && returning ? ('drawer' as const) : ('picker' as const),
        ready,
        drawerMethods,
        pickerMethods,
    }
}
