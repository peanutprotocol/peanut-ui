/**
 * Build a Crisp pre-fill message for the `contact-support` NextAction that the
 * BE emits when a rail lands in REQUIRES_SUPPORT (our pipeline broke en route
 * to the provider — Bridge 5xx after retries, missing user email, etc).
 *
 * The user-facing copy stays generic ("we hit a snag on our side"); the
 * machine-readable details (failureReason, railId, userId) are appended so the
 * support agent can dispatch the right recovery script without re-investigating.
 *
 * Shape is deliberately simple plaintext — Crisp's prefill renders it as the
 * user's first message in the conversation. The "Hi support" framing is the
 * voice the user "sends"; the bracketed block reads as machine-attached
 * context that the agent can copy/paste into their ops tooling.
 */
import type { CapabilityReason } from '@/types/capabilities'

export function buildContactSupportMessage(args: {
    reason?: CapabilityReason
    railId?: string
    userId?: string
}): string {
    const { reason, railId, userId } = args
    const lines: string[] = []
    lines.push(
        reason?.userMessage ??
            'Hi! I tried to finish my verification but something went wrong on the app side — could you help me sort this out?'
    )
    lines.push('')
    lines.push('— context for support —')
    if (reason?.code) lines.push(`reason: ${reason.code}`)
    if (reason?.details) lines.push(`details: ${reason.details}`)
    if (railId) lines.push(`rail: ${railId}`)
    if (userId) lines.push(`user: ${userId}`)
    return lines.join('\n')
}
