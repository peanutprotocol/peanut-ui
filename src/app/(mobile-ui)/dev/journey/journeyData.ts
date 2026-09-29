/**
 * In-app surface catalog for the /dev/journey Activation Journey Explorer.
 *
 * Transcribed from the activation journey UI inventory (local/scratch/
 * journey-ui-inventory.md, 2026-07-23) INCLUDING source-file annotations so
 * drift is traceable: when a surface's copy or gating changes in its source
 * file, update the matching entry here.
 *
 * The email/push half of the board is NOT here — it is fetched live from
 * peanut-api-ts GET /__dev/journey-spec (api PR #1234) so the Explorer always
 * renders the real machine, never a hand-copied description.
 */

import type { FunnelState, InAppSurface, JourneyFinding } from './journeyTypes'

// Dev-only tool: the sandbox API origin is hardcoded on purpose (the __dev
// endpoints set CORS * and only exist when DEV_EMAIL_PREVIEW=true locally).
export const JOURNEY_API_BASE = 'http://localhost:5050'

export const FUNNEL_STATES: FunnelState[] = [
    {
        id: 'no-access',
        label: 'New applicant',
        description: 'Public card application entry; identity verification not yet complete.',
        specStages: [],
        noEmailReason: 'No card application started yet.',
        includesPushReminder: true,
    },
    {
        id: 'access-pre-kyc',
        label: 'Application, pre-KYC',
        description: 'Card application started, identity verification not approved yet.',
        specStages: ['verify'],
        includesWelcome: true,
        includesPushReminder: true,
    },
    {
        id: 'kycd-no-card',
        label: "KYC'd, no card",
        description: 'Sumsub approved, no (non-canceled) Rain card yet.',
        specStages: ['create_card'],
    },
    {
        id: 'application-in-flight',
        label: 'Application in flight',
        description: 'Card exists but none ACTIVE — pending / review / RFI.',
        specStages: [],
        noEmailReason:
            'finish_setup was deleted (0 sends ever — NOT_ACTIVATED is written nowhere). No stage copy is true here, so the machine is silent by design.',
    },
    {
        id: 'card-active-unfunded',
        label: 'Card active, unfunded',
        description: 'ACTIVE card, no completed ONRAMP/CRYPTO_DEPOSIT.',
        specStages: ['fund'],
    },
    {
        id: 'funded-no-spend',
        label: 'Funded, no spend',
        description: 'Money in, no genuine card spend (> $0, not FAILED).',
        specStages: ['first_spend'],
    },
    {
        id: 'spent',
        label: 'Spent → dormant',
        description:
            'First real spend done — silent while active. Going quiet for 6 weeks (any formerly-transacting spender, card or QR) re-enters as win_back.',
        specStages: ['win_back'],
    },
]

export const IN_APP_SURFACES: InAppSurface[] = [
    // ---------- 🏠 home activation steps (ActivationCTAs) ----------
    {
        id: 'home-checklist',
        kind: 'step',
        name: 'Getting-started checklist',
        copy: '"Get started" — Create account ✓ · Verify identity · Add money · First payment',
        cta: { label: 'row tap', dest: '/profile/accounts | Add drawer | first-payment chooser, /card or QR scanner' },
        condition:
            'Home until the first payment (resolveOnboarding, utils/activation-step.utils.ts). Verify: identity verified; "In review" on the subtitle while processing. Add money: any money received (milestone funded) or any wallet/collateral balance. First payment: API isActivated (card spend or QR pay); the row exists when the card or QR pay is open (selectFirstPaymentRoute). QR pay is open to every user in any country once verified, unless the capabilities block it, so only a user with no card AND blocked QR pay has three rows and completes at Add money. While card eligibility is unknown the row holds its place. Replaced only by the region-restricted card or a provider rejection.',
        sourceFile: 'src/components/Home/GettingStartedChecklist.tsx',
        states: ['no-access', 'access-pre-kyc', 'kycd-no-card', 'card-active-unfunded', 'funded-no-spend'],
        isNewInThisPr: true,
    },
    {
        id: 'modal-spend-chooser',
        kind: 'modal',
        name: 'First-payment chooser',
        copy: '"Choose how to spend" — "Both count as your first payment." Card → /card, QR → scanner',
        cta: { label: 'Pay with card / Scan a QR code', dest: '/card | QR scanner' },
        condition:
            'Opened by the first-payment row when both the card and a QR rail are open (selectFirstPaymentRoute = card_qr)',
        sourceFile: 'src/components/Home/FirstPaymentChooser.tsx',
        states: ['kycd-no-card', 'card-active-unfunded', 'funded-no-spend'],
    },
    {
        id: 'step-email-blocked',
        kind: 'step',
        name: 'Activation step: email-blocked override',
        copy: '"Add your email" — "We need an email address to finish setting up your account."',
        cta: { label: 'Add email', dest: 'ProvideEmailStep sheet (inline)' },
        condition: 'Rail blocked with selfHealKind=provide-email — outranks fixable RFI',
        sourceFile: 'src/components/Home/ActivationCTAs.tsx',
        states: ['kycd-no-card'],
        isNewInThisPr: true,
    },
    {
        id: 'step-rejection-fixable',
        kind: 'step',
        name: 'Activation step: provider rejection (fixable)',
        copy: '"Complete your setup" — rail-specific message, else "We need an updated document before you can add money."',
        cta: { label: 'Upload document', dest: 'inline Sumsub self-heal resubmit' },
        condition: 'Sumsub approved but a bank/qr rail is fixable-rejected; suppressed when canAlreadyTransact',
        sourceFile: 'src/components/Home/ActivationCTAs.tsx',
        states: ['kycd-no-card'],
    },
    {
        id: 'step-rejection-blocked',
        kind: 'step',
        name: 'Activation step: provider rejection (blocked)',
        copy: '"Verification issue" — "Contact support for help with your verification."',
        cta: { label: 'Contact support', dest: 'Crisp (pre-filled failure context)' },
        condition: 'Terminal-blocked rail, no fixable path; suppressed when canAlreadyTransact',
        sourceFile: 'src/components/Home/ActivationCTAs.tsx',
        states: ['kycd-no-card'],
    },

    // ---------- 🏠 home carousel (activated users, 7d dismiss) ----------
    {
        id: 'carousel-kyc-prompt',
        kind: 'carousel',
        name: 'Carousel: KYC prompt',
        copy: '"Unlock QR code payments"',
        cta: { label: 'tap', dest: '/profile/accounts' },
        condition: '!hasKycApproval && !inFlight && card not eligible',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['no-access'],
    },
    {
        id: 'carousel-qr-payment',
        kind: 'carousel',
        name: 'Carousel: QR payment',
        copy: '"Pay with QR code payments"',
        cta: { label: 'tap', dest: 'QR scanner overlay' },
        condition: 'hasKycApproval && !hasMadeQrPayment',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['kycd-no-card'],
    },
    {
        id: 'carousel-invite-friends',
        kind: 'carousel',
        name: 'Carousel: invite friends',
        copy: '"Invite friends. Earn rewards"',
        cta: { label: 'tap', dest: '/rewards' },
        condition: '!latam && activated && !hasSentInvites',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['card-active-unfunded', 'funded-no-spend', 'spent'],
    },
    {
        id: 'carousel-latam-cashback',
        kind: 'carousel',
        name: 'Carousel: LatAm cashback invite',
        copy: '"Earn rewards on QR payments"',
        cta: { label: 'tap', dest: '/rewards' },
        condition: 'latam && activated && !hasSentInvites',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['card-active-unfunded', 'funded-no-spend', 'spent'],
    },
    {
        id: 'carousel-bug-bounty',
        kind: 'carousel',
        name: 'Carousel: bug bounty',
        copy: '"Help us improve and get $5!"',
        cta: { label: 'tap', dest: 'Crisp' },
        condition: 'activated && !SupportSurvivor badge',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['card-active-unfunded', 'funded-no-spend', 'spent'],
    },
    {
        id: 'carousel-notification-prompt',
        kind: 'carousel',
        name: 'Carousel: notification prompt',
        copy: '"Stay in the loop!"',
        cta: { label: 'tap', dest: 'push permission prompt' },
        condition: 'Native app without push permissions',
        sourceFile: 'src/hooks/useHomeCarouselCTAs.tsx',
        states: ['card-active-unfunded', 'funded-no-spend', 'spent'],
    },
    // ---------- 🏠 modals & celebrations ----------
    {
        id: 'modal-initiate-kyc',
        kind: 'modal',
        name: 'InitiateKycModal (variants)',
        copy: 'default "Unlock your account"; provider_rejection "We need extra documents"; + blocked / restart_identity / cross_region variants',
        condition: 'Opened by KYC entry points across the app',
        sourceFile: 'src/components/Kyc/InitiateKycModal.tsx',
        states: ['no-access'],
    },
    {
        id: 'modal-welcome-unlock',
        kind: 'modal',
        name: 'WelcomeUnlockDrawer',
        copy: '"🎉 You\'re unlocked" + channel bullets',
        cta: { label: 'Start sending money', dest: 'closes modal (once)' },
        condition: 'home; isKycApproved && !activationCelebratedAt',
        sourceFile: 'src/components/Home/WelcomeUnlockDrawer/index.tsx',
        states: ['kycd-no-card'],
    },
    {
        id: 'modal-kyc-in-progress-terminal',
        kind: 'modal',
        name: 'KycVerificationInProgressModal (terminal)',
        copy: '"All set" — "Your account is ready to go."',
        note: 'Copy neutralized on this branch (was a second "You\'re unlocked" celebration — see finding 4).',
        condition: 'KYC flow reaches terminal approved state',
        sourceFile: 'src/components/Kyc/KycVerificationInProgressModal.tsx',
        states: ['kycd-no-card'],
    },
    {
        id: 'modal-rain-cooldown',
        kind: 'modal',
        name: 'RainCooldownIntroModal',
        copy: '"Please wait" + link to /en/help/card-collateral',
        condition: 'post-spend collateral cooldown',
        sourceFile: 'src/components/Global/RainCooldown/IntroModal.tsx',
        states: ['spent'],
    },
    {
        id: 'toast-badge-earn',
        kind: 'modal',
        name: 'BadgeEarnToast',
        copy: '"Badge unlocked: {name}" (WAITLIST_SKIP excluded)',
        condition: 'global on /home when a badge is newly earned',
        sourceFile: 'src/components/Badges/BadgeEarnToast.tsx',
        states: ['spent'],
    },

    // ---------- 💳 /card states (computeCardState precedence) ----------
    {
        id: 'card-add-entry',
        kind: 'card-screen',
        name: '/card: AddCardEntryScreen',
        copy: 'card application entry (KYC → card creation flow)',
        condition: 'computeCardState=add-card',
        sourceFile: 'src/components/Card/AddCardEntryScreen.tsx',
        states: ['access-pre-kyc', 'kycd-no-card'],
    },
    {
        id: 'card-application-in-flight',
        kind: 'card-screen',
        name: '/card: application in flight',
        copy: 'pending / manual-review / requires-info / requires-support / rejected(FAILED) screens',
        condition: 'computeCardState ∈ {pending, manual-review, requires-info, requires-support, rejected}',
        sourceFile: 'src/components/Card/cardState.utils.ts + src/features/card/CardPage.tsx',
        states: ['application-in-flight'],
    },
    {
        id: 'card-your-card',
        kind: 'card-screen',
        name: '/card: YourCardScreen',
        copy: 'live card — balance, card art, freeze, details',
        condition: 'computeCardState=active',
        sourceFile: 'src/components/Card/YourCardScreen.tsx',
        states: ['card-active-unfunded', 'funded-no-spend', 'spent'],
    },
]

export const FINDINGS: JourneyFinding[] = [
    {
        id: 4,
        title: 'Two "You\'re unlocked" celebrations can double-fire',
        detail: 'WelcomeUnlockDrawer (home) and KycVerificationInProgressModal\'s terminal state both celebrated "You\'re unlocked" around KYC approval — a user could see both (the flow terminal never stamps activationCelebratedAt). FIXED on this branch: in-flow terminal neutralized to "All set"; home\'s WelcomeUnlockDrawer is the single celebration.',
        sourceFiles: [
            'src/components/Home/WelcomeUnlockDrawer/index.tsx',
            'src/components/Kyc/KycVerificationInProgressModal.tsx',
        ],
    },
    {
        id: 6,
        title: 'Spend chooser + canAlreadyTransact only exist on this branch',
        detail: 'The #2475 chooser ("How do you want to spend?") and the canAlreadyTransact nag suppression are only on feat/spend-with-peanut-cta, not dev — dev still jumps straight to the QR scanner.',
        sourceFiles: ['src/components/Home/ActivationCTAs.tsx'],
    },
    {
        id: 7,
        title: 'Unreachable "also for activated users" card-override branch',
        detail: "useActivationStatus's card-override branch for activated users is unreachable on home — activated users never render ActivationCTAs (they get HomeCarouselCTA). Needs runtime verification before deletion — inference-only, from the same audit that produced the retracted finding 3.",
        sourceFiles: ['src/hooks/useActivationStatus.ts'],
    },
]
