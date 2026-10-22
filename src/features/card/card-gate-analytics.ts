import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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
