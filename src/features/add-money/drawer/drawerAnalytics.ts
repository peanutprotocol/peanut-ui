import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { AddMoneyPickerMethod } from '@/features/add-money/addMoneyMethods'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { RhinoChainType } from '@/services/services.types'
import type { DrawerBankRow } from './addMoneyDrawerPlan'

/*
 * The add-money drawer's events, named per place: each place keeps its own funnel, so the card's
 * event names stay the ones its dashboards read. Properties are codes only: no amount, no balance.
 */
const EVENTS = {
    card: {
        opened: ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_DRAWER_OPENED,
        closed: ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_DRAWER_CLOSED,
        networkPicked: ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_NETWORK_PICKED,
        railPicked: ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_RAIL_PICKED,
        verifyTapped: ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_VERIFY_TAPPED,
        /** the place's own add-funds event: a rail picked in the drawer counts as its method there */
        methodPicked: ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED,
    },
} as const

/** The place that opened the drawer; also its verify source. */
export type AddMoneyPlace = keyof typeof EVENTS

/** The two ways the drawer opens with. */
export type AddMoneyMethod = Extract<AddMoneyPickerMethod, 'bank' | 'crypto'>

/** The picker method a bank rail stands for: ARS and Pix keep their own values (TASK-25444), the rest are bank. */
export function pickerMethodOf(corridor: DepositCorridor): AddMoneyPickerMethod {
    return corridor === 'BANK_TRANSFER_AR' ? 'ars' : corridor === 'PIX_BR' ? 'pix' : 'bank'
}

/** What the add-money drawer shows (TASK-25169). */
export type AddMoneyDrawerView =
    | 'networks'
    | 'address'
    | 'rows'
    | 'details'
    | 'not_verified'
    | 'finish_setup'
    | 'not_offered'
    | 'loading'

export function captureAddMoneyDrawerOpened(place: AddMoneyPlace, method: AddMoneyMethod, view: AddMoneyDrawerView) {
    posthog.capture(EVENTS[place].opened, { method, view })
}

/** The drawer was dismissed without the balance reaching the target. */
export function captureAddMoneyDrawerClosed(place: AddMoneyPlace, method: AddMoneyMethod, view: AddMoneyDrawerView) {
    posthog.capture(EVENTS[place].closed, { method, view })
}

export function captureAddMoneyNetworkPicked(place: AddMoneyPlace, network: RhinoChainType) {
    posthog.capture(EVENTS[place].networkPicked, { network })
}

export function captureAddMoneyRailPicked(
    place: AddMoneyPlace,
    corridor: DepositCorridor,
    kind: DrawerBankRow['kind']
) {
    posthog.capture(EVENTS[place].railPicked, { corridor, kind })
}

export function captureAddMoneyVerifyTapped(place: AddMoneyPlace) {
    posthog.capture(EVENTS[place].verifyTapped, {})
}

/** A rail picked in the drawer that the opening tap did not count (ARS, Pix): same event and properties as that tap. */
export function captureAddMoneyMethodPicked(place: AddMoneyPlace, funded: boolean, method: AddMoneyPickerMethod) {
    posthog.capture(EVENTS[place].methodPicked, { step: 'funding', method, funded })
}
