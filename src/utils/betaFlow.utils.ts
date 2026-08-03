import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import store from '@/redux/store'
import { getPlatform } from '@/utils/capacitor'

/**
 * Native-app beta core-checklist flows — F1–F10 in the Notion tester tracker.
 * Values are stable event-property strings; don't rename without updating the
 * beta gate insights in PostHog.
 */
export type BetaFlow =
    | 'fresh_signup' // F1 fresh signup + passkey
    | 'returning_login' // F2 returning passkey login
    | 'send' // F3 send (any payment flow reaching success, or send link created)
    | 'receive_claim' // F4 receive / claim
    | 'kyc' // F5 KYC docs submitted (camera capture done; approval is async)
    | 'card_issue_view' // F6 card details revealed ⇒ card issued + viewed
    | 'deposit' // F7 crypto deposit completed, or fiat wire details shown
    | 'withdraw' // F8 withdraw completed
    | 'push_tap' // F9 push notification received + tapped
    | 'deep_link' // F10 deep link routed into the app

/**
 * Fire `beta_flow_completed { flow, platform, tester_id }` for a checklist
 * flow the user just finished. Fires on every platform — gate queries filter
 * `platform` to the native pair. `tester_id` duplicates the username onto the
 * event so the gate-1 matrix reads straight off event properties without a
 * person join; pass `testerId` where the redux user isn't populated yet
 * (fresh signup).
 */
export function captureBetaFlow(flow: BetaFlow, testerId?: string): void {
    const user = store.getState().user.user
    posthog.capture(ANALYTICS_EVENTS.BETA_FLOW_COMPLETED, {
        flow,
        platform: getPlatform(),
        tester_id: testerId ?? user?.user?.username ?? user?.user?.userId ?? 'anonymous',
    })
}
