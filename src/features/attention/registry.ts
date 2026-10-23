import type { AttentionAsk, JourneyState } from './types'
import { MODAL_TYPES } from '@/constants/analytics.consts'

/*
 * The tier is the display urgency; `rank` is the order inside the tier and
 * follows the journey order of the Notion page "User Journey: Prioritized
 * activation and retention actions" (its number is noted per ask as N<n>).
 * Two asks sit above their Notion position on purpose: updated terms (N15)
 * carries a legal clock, and announcements (not on the page) may never
 * outrank a step of the journey.
 */

const parsedThreshold = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_THRESHOLD ?? '500')
export const BALANCE_WARNING_THRESHOLD_USD = Number.isNaN(parsedThreshold) ? 500 : parsedThreshold
const parsedExpiry = parseInt(process.env.NEXT_PUBLIC_BALANCE_WARNING_EXPIRY ?? '1814400')
const BALANCE_WARNING_EXPIRY_DAYS = (Number.isNaN(parsedExpiry) ? 1814400 : parsedExpiry) / 86400

const loggedIn = (s: JourneyState) => (s.userId ? (s.userLoaded ? 'ready' : 'unknown') : 'ineligible')

export const legalReconsent: AttentionAsk = {
    id: 'legal-reconsent',
    tier: 1,
    rank: 1, // N15
    presentation: 'modal',
    surfaces: ['interrupt'],
    eligible: (s) => {
        if (!s.userId) return 'ineligible'
        if (s.consent.status === 'unknown') return 'unknown'
        return s.consent.status === 'needed' ? 'show' : 'done'
    },
    version: (s) => (s.consent.versions.length ? s.consent.versions.join(',') : undefined),
    // ToS §17.3: a prompt, never a lock, so "Not now" exists; the modal
    // computes its own snooze date from the documents' effective dates
    policy: { routes: 'any', snoozeDays: 7 },
    analyticsKey: MODAL_TYPES.RE_CONSENT,
}

export const arrival: AttentionAsk = {
    id: 'arrival',
    tier: 1,
    // TASK-23251 put it above the balance warning; it is only true while the user is in that country
    rank: 2,
    presentation: 'drawer',
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (s.arrival === 'unknown') return 'unknown'
        return s.arrival === 'raised' ? 'show' : 'ineligible'
    },
    // the backend raises each arrival once; the next trip must not inherit this one's dismissal
    policy: { expiryDays: 0 },
    analyticsKey: 'arrival_prompt',
}

export const balanceBackup: AttentionAsk = {
    id: 'balance-backup',
    tier: 1,
    rank: 3, // N14, urgent variant
    presentation: 'drawer',
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.balance.loaded) return 'unknown'
        // two credentials already back the balance up; null is an API without the field
        if ((s.passkeyCount ?? 1) >= 2) return 'done'
        return s.balance.usd > BALANCE_WARNING_THRESHOLD_USD ? 'show' : 'ineligible'
    },
    policy: { expiryDays: BALANCE_WARNING_EXPIRY_DAYS },
    analyticsKey: MODAL_TYPES.BALANCE_WARNING,
}

const DAY_MS = 24 * 60 * 60 * 1000
export const NEXT_PAYMENT_AFTER_DAYS = 14

export const verificationDue: AttentionAsk = {
    id: 'verification-due',
    tier: 1,
    rank: 4, // N4, a check already started
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.dueTasks > 0 ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'verification_task',
}

export const postVerificationAction: AttentionAsk = {
    id: 'post-verification-action',
    tier: 1,
    rank: 5, // not on the page
    presentation: 'modal',
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.identity.isVerified && s.postAuthRedirect ? 'show' : 'ineligible'
    },
    version: (s) => s.postAuthRedirectDestination ?? undefined,
    policy: {},
    analyticsKey: MODAL_TYPES.POST_SIGNUP,
}

export const finishCardSetup: AttentionAsk = {
    id: 'finish-card-setup',
    tier: 1,
    rank: 6, // not on the page; needs an active card, so never live before verify
    presentation: 'modal',
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.card.loaded) return 'unknown'
        return s.card.needsSetup ? 'show' : 'ineligible'
    },
    version: (s) => s.card.activeCardId ?? undefined,
    policy: {},
    analyticsKey: 'finish_card_setup',
}

export const installApp: AttentionAsk = {
    id: 'install-app',
    tier: 1,
    // N1, and the most critical ask (Slava, 2026-10-12): the web app is being retired
    rank: 0,
    presentation: 'modal',
    surfaces: ['interrupt', 'zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return !s.isNative && s.migration.on ? 'show' : 'ineligible'
    },
    policy: { snoozeDays: 3 },
    analyticsKey: MODAL_TYPES.MIGRATION_DOWNLOAD,
}

export const blockedCard: AttentionAsk = {
    id: 'blocked-card',
    tier: 2,
    rank: 2, // replaces the checklist
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.blockedCardId ? 'show' : 'ineligible'
    },
    version: (s) => s.blockedCardId ?? undefined,
    policy: { anchorsHome: true },
    analyticsKey: 'blocked_card',
}

export const checklist: AttentionAsk = {
    id: 'checklist',
    tier: 2,
    rank: 3, // N2–N7, one card
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.onboarding) return 'unknown'
        return s.onboarding.step === 'completed' ? 'done' : 'show'
    },
    policy: { anchorsHome: true },
    analyticsKey: 'checklist',
}

export const pushHomeFallback: AttentionAsk = {
    id: 'push-home-fallback',
    tier: 4,
    rank: 2, // N16, after the backup passkey (N14)
    presentation: 'modal',
    surfaces: ['interrupt', 'zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.push.ready) return 'unknown'
        // a money moment already asked this session: one pre-prompt per session
        if (s.push.unanswered) return s.push.promptedThisSession ? 'ineligible' : 'show'
        // answered but not on: the native card opens the OS settings
        return s.push.notEnabled ? 'show' : 'done'
    },
    policy: {
        minSessions: 3,
        snoozeDays: 14,
        // the OS dialog is one-shot: the pre-prompt only while it is unanswered; the card only where settings can be opened
        surfaceWhen: { interrupt: (s) => s.push.unanswered, zone: (s) => s.isNative },
    },
    analyticsKey: MODAL_TYPES.NOTIFICATIONS,
}

export const verificationAdvisory: AttentionAsk = {
    id: 'verification-advisory',
    tier: 3,
    rank: 0, // a document a partner asked for, due later; not dismissible
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.documentSlideKey ? 'show' : 'ineligible'
    },
    version: (s) => s.documentSlideKey ?? undefined,
    policy: {},
    analyticsKey: 'document_request',
}

export const qrPayment: AttentionAsk = {
    id: 'qr-payment',
    tier: 3,
    rank: 2, // N9
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.qr.canPayNow) return 'ineligible'
        if (s.qr.hasMadeQrPayment === undefined) return 'unknown'
        return s.qr.hasMadeQrPayment ? 'done' : 'show'
    },
    policy: {},
    analyticsKey: 'qr_payment',
}

export const verifyForQr: AttentionAsk = {
    id: 'verify-for-qr',
    tier: 3,
    rank: 3, // N9, the ID check that opens it
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.qr.verifyOpensQr ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'kyc_prompt',
}

export const cardOffer: AttentionAsk = {
    id: 'card-offer',
    tier: 3,
    rank: 4, // N6 for an activated user
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated || s.cardOffer.promotionDisabled) return 'ineligible'
        if (!s.cardOffer.loaded) return 'unknown'
        return s.cardOffer.geoProhibited || s.cardOffer.hasCardRelationship ? 'ineligible' : 'show'
    },
    policy: {},
    analyticsKey: 'card_offer',
}

export const invite: AttentionAsk = {
    id: 'invite',
    tier: 5,
    rank: 1, // N19
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.activated && s.invitesSent === 0 ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: MODAL_TYPES.INVITE,
}

export const bugBounty: AttentionAsk = {
    id: 'bug-bounty',
    tier: 5,
    rank: 5, // campaign
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.activated && !s.hasSupportSurvivorBadge ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'bug_bounty',
}

export const userInterview: AttentionAsk = {
    id: 'user-interview',
    tier: 5,
    rank: 0, // campaign: hand-picked users, leads the growth tier while it runs
    surfaces: ['zone'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.flags.userInterview ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'user_interview',
}

export const earlyUser: AttentionAsk = {
    id: 'early-user',
    tier: 6,
    rank: 1, // not on the page
    presentation: 'drawer',
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (s.showEarlyUserModal === undefined) return 'unknown'
        return s.showEarlyUserModal ? 'show' : 'done'
    },
    policy: {},
    analyticsKey: MODAL_TYPES.EARLY_USER,
}

const zoneAsk = (
    id: AttentionAsk['id'],
    tier: AttentionAsk['tier'],
    rank: number,
    analyticsKey: string,
    eligible: AttentionAsk['eligible'],
    extra: Partial<Pick<AttentionAsk, 'version' | 'policy'>> = {}
): AttentionAsk => ({ id, tier, rank, surfaces: ['zone'], eligible, policy: {}, analyticsKey, ...extra })

export const virtualAccount = zoneAsk('virtual-account', 3, 1, 'virtual_account', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    if (!s.depositAccounts.enabled) return 'ineligible'
    if (!s.depositAccounts.loaded) return 'unknown'
    if (s.depositAccounts.active > 0) return 'done'
    return s.depositAccounts.claimable > 0 ? 'show' : 'ineligible'
}) // N8

export const nextPayment = zoneAsk('next-payment', 3, 5, 'next_payment', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    if (!s.activated || !s.balance.loaded || s.balance.usd <= 0) return 'ineligible'
    if (s.qr.hasMadeQrPayment === undefined) return 'unknown'
    const last = s.lastSpendAt ? Date.parse(s.lastSpendAt) : NaN
    return !Number.isFinite(last) || s.now - last > NEXT_PAYMENT_AFTER_DAYS * DAY_MS ? 'show' : 'ineligible'
}) // N10

export const shareBankDetails = zoneAsk('share-bank-details', 3, 6, 'share_bank_details', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    return s.depositAccounts.active > 0 ? 'show' : 'ineligible'
}) // N11

export const requestMoney = zoneAsk('request-money', 3, 7, 'request_money', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    if (!s.activated) return 'ineligible'
    if (s.hasReceivedRequestPayment === undefined) return 'unknown'
    return s.hasReceivedRequestPayment ? 'done' : 'show'
}) // N12

export const sendMoney = zoneAsk('send-money', 3, 8, 'send_money', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    if (!s.activated) return 'ineligible'
    return s.firstPeerPaymentAt ? 'done' : 'show'
}) // N13

export const backupPasskey = zoneAsk('backup-passkey', 4, 1, 'backup_passkey', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    // null: an API without the field; 0: a bad row. Neither is a reason to ask.
    if (s.passkeyCount === null || s.passkeyCount < 1) return 'ineligible'
    return s.passkeyCount === 1 ? 'show' : 'done'
}) // N14

export const addEmail = zoneAsk('add-email', 4, 3, 'add_email', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    return s.hasEmail ? 'done' : 'show'
}) // N17

export const rewards = zoneAsk(
    'rewards',
    5,
    2,
    'rewards',
    (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated) return 'ineligible'
        if (s.rewardsPendingUsd === undefined) return 'unknown'
        return s.rewardsPendingUsd > 0 ? 'show' : 'ineligible'
    },
    // a new pending balance re-arms a card the user already acted on
    { version: (s) => (s.rewardsPendingUsd === undefined ? undefined : String(s.rewardsPendingUsd)) }
) // N20

export const completeProfile = zoneAsk('complete-profile', 5, 4, 'complete_profile', (s) => {
    const gate = loggedIn(s)
    if (gate !== 'ready') return gate
    if (!s.activated) return 'ineligible'
    return s.hasFullName ? 'done' : 'show'
}) // N22

export const verificationDeadline: AttentionAsk = {
    id: 'verification-deadline',
    tier: 3,
    rank: 1,
    surfaces: ['inline'],
    slots: ['bank-transfer'],
    eligible: (s) => {
        const gate = loggedIn(s)
        return gate === 'ready' ? 'show' : gate
    },
    policy: {
        slotWhen: (_, context) =>
            typeof context?.advisoryDeadline === 'string' && !Number.isNaN(Date.parse(context.advisoryDeadline)),
    },
    analyticsKey: 'verification-deadline',
}

export const capNudge: AttentionAsk = {
    id: 'cap-nudge',
    tier: 3,
    rank: 2,
    surfaces: ['inline'],
    slots: ['limits'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.capNudge === undefined ? 'unknown' : s.capNudge !== null ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'cap-nudge',
}

export const maintenance: AttentionAsk = {
    id: 'maintenance',
    tier: 1,
    rank: 0,
    surfaces: ['banner'],
    eligible: (s) => (s.maintenance === 'none' ? 'ineligible' : 'show'),
    policy: {},
    analyticsKey: 'maintenance',
}

export const ASKS: readonly AttentionAsk[] = [
    maintenance,
    verificationDeadline,
    capNudge,
    legalReconsent,
    arrival,
    balanceBackup,
    verificationDue,
    postVerificationAction,
    finishCardSetup,
    installApp,
    blockedCard,
    checklist,
    pushHomeFallback,
    earlyUser,
    verificationAdvisory,
    qrPayment,
    verifyForQr,
    cardOffer,
    invite,
    bugBounty,
    userInterview,
    virtualAccount,
    nextPayment,
    shareBankDetails,
    requestMoney,
    sendMoney,
    backupPasskey,
    addEmail,
    rewards,
    completeProfile,
]
