import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

/** What the user tapped on a receipt. */
export type ReceiptAction = 'share_link' | 'share_pdf' | 'download_pdf' | 'split'

/** Where the control sat: the one primary button, a More actions row, or the QR payment success screen. */
export type ReceiptActionPlacement = 'primary' | 'more_actions' | 'qr_success'

/**
 * Records one tap on a receipt action. The tap, not its outcome: a share sheet
 * the user closes still says they wanted to share. The event answers which
 * action a receipt should lead with (TASK-24141).
 */
export function trackReceiptAction(action: ReceiptAction, placement: ReceiptActionPlacement, kind?: string): void {
    posthog.capture(ANALYTICS_EVENTS.RECEIPT_ACTION_TAPPED, { action, placement, kind })
}
