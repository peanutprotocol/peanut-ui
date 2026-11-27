import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { AddMoneyPickerMethod } from '@/features/add-money/addMoneyMethods'
import type { DrawerMethod } from '@/features/add-money/drawer/drawerAnalytics'

/*
 * The card gate funnel: card_state_viewed (state add-card) → card_gate_step_viewed
 * → card_gate_add_funds_tapped → deposit_completion (server side, every rail)
 * → card_apply_attempted. Properties are codes only: no amount, no balance.
 */

export type CardGateStep = 'eligibility' | 'available' | 'funding' | 'entry'

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
    method: AddMoneyPickerMethod | null = null
): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED, { step, method, funded })
}

/** Before/after for the drawer: did the user fund inside it or on another path? */
export function captureCardGateCameBackFunded(inDrawer: boolean, method: DrawerMethod | null): void {
    posthog.capture(ANALYTICS_EVENTS.CARD_GATE_CAME_BACK_FUNDED, { in_drawer: inDrawer, method })
}
