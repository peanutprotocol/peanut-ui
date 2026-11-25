import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { RhinoChainType } from '@/services/services.types'
import type { CardBankRow } from './cardAddMoney'

/*
 * The card gate funnel: card_state_viewed (state add-card) → card_gate_step_viewed
 * → card_gate_add_funds_tapped → deposit_completion (server side, every rail)
 * → card_apply_attempted. Properties are codes only: no amount, no balance.
 */

export type CardGateStep = 'eligibility' | 'available' | 'funding' | 'entry'
export type CardFundingMethod = 'bank' | 'crypto'

export function captureCardGateStepViewed(step: CardGateStep, funded: boolean, minBalanceShown: boolean): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_STEP_VIEWED, {
        step,
        funded,
        min_balance_shown: minBalanceShown,
    })
}

export function captureCardGateAddFundsTapped(
    step: CardGateStep,
    funded: boolean,
    method: CardFundingMethod | null = null
): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED, { step, method, funded })
}

/** What the add-money drawer shows (TASK-25169). */
export type CardAddMoneyView =
    | 'networks'
    | 'address'
    | 'rows'
    | 'details'
    | 'setting_up'
    | 'under_review'
    | 'not_verified'
    | 'finish_setup'
    | 'loading'

export function captureCardAddMoneyDrawerOpened(method: CardFundingMethod, view: CardAddMoneyView): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_DRAWER_OPENED, { method, view })
}

/** The drawer was dismissed without the balance reaching the minimum. */
export function captureCardAddMoneyDrawerClosed(method: CardFundingMethod, view: CardAddMoneyView): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_DRAWER_CLOSED, { method, view })
}

export function captureCardAddMoneyNetworkPicked(network: RhinoChainType): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_NETWORK_PICKED, { network })
}

export function captureCardAddMoneyRailPicked(corridor: DepositCorridor, kind: CardBankRow['kind']): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_RAIL_PICKED, { corridor, kind })
}

export function captureCardAddMoneyVerifyTapped(): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_MONEY_VERIFY_TAPPED, {})
}

/** Before/after for the drawer: did the user fund inside it or on another path? */
export function captureCardGateCameBackFunded(inDrawer: boolean, method: CardFundingMethod | null): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_CAME_BACK_FUNDED, { in_drawer: inDrawer, method })
}
