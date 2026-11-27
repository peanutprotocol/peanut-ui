import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
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
    },
} as const

/** The place that opened the drawer; also its verify source. */
export type AddMoneyPlace = keyof typeof EVENTS

export type AddMoneyMethod = 'bank' | 'crypto'

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
