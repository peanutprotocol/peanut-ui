import type { AttentionAsk, JourneyState } from './types'
import { defineAsk, DEFAULT_SETTINGS } from './catalogue'
import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'

/*
 * The tier is the display urgency; `rank` is the order inside the tier and
 * follows the journey order of the Notion page "User Journey: Prioritized
 * activation and retention actions" (its number is noted per ask as N<n>).
 * Two asks sit above their Notion position on purpose: updated terms (N15)
 * carries a legal clock, and announcements (not on the page) may never
 * outrank a step of the journey.
 */

export const BALANCE_WARNING_THRESHOLD_USD = DEFAULT_SETTINGS.balanceThresholdUsd

const loggedIn = (s: JourneyState) => (s.userId ? (s.userLoaded ? 'ready' : 'unknown') : 'ineligible')

const storeUpdateGate = (tier: 1 | 4) => (s: JourneyState) =>
    s.userId && s.userLoaded && s.isNative && s.storeUpdatePrompt?.tier === tier && s.storeUpdatePrompt.version
        ? ('ready' as const)
        : ('ineligible' as const)

export const appUpdateImportant = defineAsk('app-update-important', {
    presentation: 'drawer',
    deviceGate: storeUpdateGate(1),
    eligible: (s) => (storeUpdateGate(1)(s) === 'ready' ? 'show' : 'ineligible'),
    version: (s) => s.storeUpdatePrompt?.version,
})

export const appUpdateRegular = defineAsk('app-update-regular', {
    deviceGate: storeUpdateGate(4),
    eligible: (s) => (storeUpdateGate(4)(s) === 'ready' ? 'show' : 'ineligible'),
    version: (s) => s.storeUpdatePrompt?.version,
})

export const legalReconsent: AttentionAsk = defineAsk('legal-reconsent', {
    presentation: 'modal',
    eligible: (s) => {
        if (!s.userId) return 'ineligible'
        if (s.consent.status === 'unknown') return 'unknown'
        return s.consent.status === 'needed' ? 'show' : 'done'
    },
    // the modal lists the documents from the app's own status check, so a failed check has nothing to accept
    renderable: (s) => s.consent.documents.length > 0,
    version: (s) => (s.consent.versions.length ? s.consent.versions.join(',') : undefined),
    legacyProps: (s) => ({ documents: s.consent.documents.map((d) => d.slug) }),
})

export const arrival: AttentionAsk = defineAsk('arrival', {
    presentation: 'drawer',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (s.arrival === 'unknown') return 'unknown'
        return s.arrival === 'raised' ? 'show' : 'ineligible'
    },
})

export const balanceBackup: AttentionAsk = defineAsk('balance-backup', {
    presentation: 'drawer',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.balance.loaded) return 'unknown'
        // two credentials already back the balance up; null is an API without the field
        if ((s.passkeyCount ?? 1) >= 2) return 'done'
        return s.balance.usd > (s.attentionSettings?.balanceThresholdUsd ?? BALANCE_WARNING_THRESHOLD_USD)
            ? 'show'
            : 'ineligible'
    },
    legacyProps: (_s, event) => (event === 'acted' ? { cta: 'slide_to_continue' } : {}),
})

const DAY_MS = 24 * 60 * 60 * 1000
export const NEXT_PAYMENT_AFTER_DAYS = DEFAULT_SETTINGS.nextPaymentAfterDays

export const verificationDue: AttentionAsk = defineAsk('verification-due', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.dueTasks > 0 ? 'show' : 'ineligible'
    },
})

export const postVerificationAction: AttentionAsk = defineAsk('post-verification-action', {
    presentation: 'modal',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.identity.isVerified && s.postAuthRedirect ? 'show' : 'ineligible'
    },
    version: (s) => s.postAuthRedirectDestination?.split(/[?#]/, 1)[0] || undefined,
})

export const finishCardSetup: AttentionAsk = defineAsk('finish-card-setup', {
    presentation: 'modal',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.card.loaded) return 'unknown'
        if (!s.card.needsSetup) return 'ineligible'
        // the surface shows only on the existing permission; managed funding is finish-card-funding
        if (s.card.setupPath === 'unknown') return 'unknown'
        return s.card.setupPath === 'legacy' ? 'show' : 'ineligible'
    },
    version: (s) => s.card.activeCardId ?? undefined,
})

export const finishCardFunding: AttentionAsk = defineAsk('finish-card-funding', {
    presentation: 'modal',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.card.loaded || s.card.setupPath === 'unknown') return 'unknown'
        if (s.card.setupPath !== 'managed') return 'ineligible'
        if (s.card.needsFunding === undefined) return 'unknown'
        return s.card.needsFunding ? 'show' : 'ineligible'
    },
    version: (s) => s.card.activeCardId ?? undefined,
})

export const installApp: AttentionAsk = defineAsk('install-app', {
    presentation: 'modal',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return !s.isNative && s.migration.on ? 'show' : 'ineligible'
    },
})

export const blockedCard: AttentionAsk = defineAsk('blocked-card', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.blockedCardId ? 'show' : 'ineligible'
    },
    version: (s) => s.blockedCardId ?? undefined,
})

// No blocked-card check: the card outranks the list, and once hidden the list takes Home, as the API ranks it.
export const checklist: AttentionAsk = defineAsk('checklist', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.onboarding) return 'unknown'
        return s.onboarding.step === 'completed' ? 'done' : 'show'
    },
})

export const pushHomeFallback: AttentionAsk = defineAsk('push-home-fallback', {
    presentation: 'modal',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.push.ready) return 'unknown'
        // a money moment already asked this session: one pre-prompt per session
        if (s.push.unanswered) return s.push.promptedThisSession ? 'ineligible' : 'show'
        // answered but not on: the native card opens the OS settings
        return s.push.notEnabled ? 'show' : 'done'
    },
    version: (s) => `${s.isNative ? 'native' : 'web'}:${s.push.unanswered ? 'prompt' : 'settings'}`,
    policy: {
        // the OS dialog is one-shot: the pre-prompt only while it is unanswered; the card only where settings can be opened
        surfaceWhen: { interrupt: (s) => s.push.unanswered, zone: (s) => s.isNative },
    },
    legacyProps: (_s, event) => ({
        trigger: PUSH_PROMPT_TRIGGERS.HOME_FALLBACK,
        ...(event === 'acted' && { cta: 'enable' }),
    }),
})

export const verificationAdvisory: AttentionAsk = defineAsk('verification-advisory', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.documentSlideKey ? 'show' : 'ineligible'
    },
    version: (s) => s.documentSlideKey ?? undefined,
})

export const qrPayment: AttentionAsk = defineAsk('qr-payment', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.qr.canPayNow) return 'ineligible'
        if (s.qr.hasMadeQrPayment === undefined) return 'unknown'
        return s.qr.hasMadeQrPayment ? 'done' : 'show'
    },
})

export const verifyForQr: AttentionAsk = defineAsk('verify-for-qr', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.qr.verifyOpensQr ? 'show' : 'ineligible'
    },
})

export const cardOffer: AttentionAsk = defineAsk('card-offer', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated || s.cardOffer.promotionDisabled) return 'ineligible'
        if (!s.cardOffer.loaded) return 'unknown'
        return s.cardOffer.geoProhibited || s.cardOffer.hasCardRelationship ? 'ineligible' : 'show'
    },
})

export const invite: AttentionAsk = defineAsk('invite', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.activated && s.invitesSent === 0 ? 'show' : 'ineligible'
    },
})

export const bugBounty: AttentionAsk = defineAsk('bug-bounty', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.activated && !s.hasSupportSurvivorBadge ? 'show' : 'ineligible'
    },
})

export const userInterview: AttentionAsk = defineAsk('user-interview', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.flags.userInterview ? 'show' : 'ineligible'
    },
})

export const earlyUser: AttentionAsk = defineAsk('early-user', {
    presentation: 'drawer',
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (s.showEarlyUserModal === undefined) return 'unknown'
        return s.showEarlyUserModal ? 'show' : 'done'
    },
})

export const virtualAccount = defineAsk('virtual-account', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.depositAccounts.enabled) return 'ineligible'
        if (!s.depositAccounts.loaded) return 'unknown'
        if (s.depositAccounts.active > 0) return 'done'
        return s.depositAccounts.claimable > 0 ? 'show' : 'ineligible'
    },
}) // N8

export const nextPayment = defineAsk('next-payment', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated || !s.balance.loaded || s.balance.usd <= 0) return 'ineligible'
        if (!s.qr.canPayNow && s.cardOffer.canSpendViaCard !== true) return 'ineligible'
        if (s.spendHistoryAvailable === false) return 'unknown'
        if (s.qr.hasMadeQrPayment === undefined) return 'unknown'
        const last = s.lastSpendAt ? Date.parse(s.lastSpendAt) : NaN
        return !Number.isFinite(last) ||
            s.now - last > (s.attentionSettings?.nextPaymentAfterDays ?? NEXT_PAYMENT_AFTER_DAYS) * DAY_MS
            ? 'show'
            : 'ineligible'
    },
}) // N10

export const shareBankDetails = defineAsk('share-bank-details', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        // the details reached a payer once money arrived by bank transfer; unknown keeps asking
        if (s.bankDepositReceived === true) return 'done'
        return s.depositAccounts.active > 0 ? 'show' : 'ineligible'
    },
}) // N11

export const requestMoney = defineAsk('request-money', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated) return 'ineligible'
        if (s.hasReceivedRequestPayment === undefined) return 'unknown'
        return s.hasReceivedRequestPayment ? 'done' : 'show'
    },
}) // N12

export const sendMoney = defineAsk('send-money', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated) return 'ineligible'
        return s.firstPeerPaymentAt ? 'done' : 'show'
    },
}) // N13

// the backup guide has iPhone and Android steps only
const backupGuideFits = (s: JourneyState) =>
    s.deviceType === null ? 'unknown' : s.deviceType === 'web' ? 'ineligible' : 'ready'

export const backupPasskey = defineAsk('backup-passkey', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        const device = backupGuideFits(s)
        if (device !== 'ready') return device
        // null: an API without the field; 0: a bad row. Neither is a reason to ask.
        if (s.passkeyCount === null || s.passkeyCount < 1) return 'ineligible'
        return s.passkeyCount === 1 ? 'show' : 'done'
    },
    deviceGate: backupGuideFits,
}) // N14

export const addEmail = defineAsk('add-email', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.hasEmail ? 'done' : 'show'
    },
}) // N17

export const rewards = defineAsk('rewards', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated) return 'ineligible'
        if (s.rewardsPendingUsd === undefined) return 'unknown'
        return s.rewardsPendingUsd > 0 ? 'show' : 'ineligible'
    },
    version: (s) => (s.rewardsPendingUsd === undefined ? undefined : String(s.rewardsPendingUsd)),
}) // N20

export const completeProfile = defineAsk('complete-profile', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        if (!s.activated) return 'ineligible'
        return s.hasFullName ? 'done' : 'show'
    },
}) // N22

export const verificationDeadline: AttentionAsk = defineAsk('verification-deadline', {
    eligible: (s) => {
        const gate = loggedIn(s)
        return gate === 'ready' ? 'show' : gate
    },
    policy: {
        slotWhen: (_, context) =>
            typeof context?.advisoryDeadline === 'string' && !Number.isNaN(Date.parse(context.advisoryDeadline)),
    },
})

export const capNudge: AttentionAsk = defineAsk('cap-nudge', {
    eligible: (s) => {
        const gate = loggedIn(s)
        if (gate !== 'ready') return gate
        return s.capNudge === undefined ? 'unknown' : s.capNudge !== null ? 'show' : 'ineligible'
    },
})

export const maintenance: AttentionAsk = defineAsk('maintenance', {
    eligible: (s) => (s.maintenance === 'none' ? 'ineligible' : 'show'),
})

export const ASKS: readonly AttentionAsk[] = [
    maintenance,
    appUpdateImportant,
    appUpdateRegular,
    verificationDeadline,
    capNudge,
    legalReconsent,
    arrival,
    balanceBackup,
    verificationDue,
    postVerificationAction,
    finishCardSetup,
    finishCardFunding,
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
