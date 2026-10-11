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

export const balanceBackup: AttentionAsk = {
    id: 'balance-backup',
    tier: 1,
    rank: 2, // N14, urgent variant
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.balance.loaded) return 'unknown'
        return s.balance.usd > BALANCE_WARNING_THRESHOLD_USD ? 'show' : 'ineligible'
    },
    policy: { expiryDays: BALANCE_WARNING_EXPIRY_DAYS },
    analyticsKey: MODAL_TYPES.BALANCE_WARNING,
}

export const verificationDue: AttentionAsk = {
    id: 'verification-due',
    tier: 1,
    rank: 3, // N4, a check already started
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
    rank: 4, // not on the page
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.identity.isVerified && s.postAuthRedirect ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: MODAL_TYPES.POST_SIGNUP,
}

export const finishCardSetup: AttentionAsk = {
    id: 'finish-card-setup',
    tier: 1,
    rank: 5, // not on the page; needs an active card, so never live before verify
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.card.loaded) return 'unknown'
        return s.card.needsSetup ? 'show' : 'ineligible'
    },
    policy: {},
    analyticsKey: 'finish_card_setup',
}

export const installApp: AttentionAsk = {
    id: 'install-app',
    tier: 2,
    rank: 1, // N1
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return !s.isNative && s.migration.on ? 'show' : 'ineligible'
    },
    // the web app is being retired, so this one T2 ask may interrupt
    policy: { interrupt: 'session', snoozeDays: 3 },
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
    policy: {},
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
    policy: {},
    analyticsKey: 'checklist',
}

export const pushHomeFallback: AttentionAsk = {
    id: 'push-home-fallback',
    tier: 4,
    rank: 1, // N16
    surfaces: ['interrupt'],
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.push.ready) return 'unknown'
        return s.push.unanswered ? 'show' : 'done'
    },
    policy: { minSessions: 3, snoozeDays: 14 },
    analyticsKey: MODAL_TYPES.NOTIFICATIONS,
}

export const earlyUser: AttentionAsk = {
    id: 'early-user',
    tier: 6,
    rank: 1, // not on the page
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

export const ASKS: readonly AttentionAsk[] = [
    legalReconsent,
    balanceBackup,
    verificationDue,
    postVerificationAction,
    finishCardSetup,
    installApp,
    blockedCard,
    checklist,
    pushHomeFallback,
    earlyUser,
]
