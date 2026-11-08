// Generated from peanut-api-ts/src/attention/onboarding.ts.
export type FirstPaymentRoute = 'card_qr' | 'card' | 'qr' | 'none' | 'pending'
export type VerifyRowStatus = 'todo' | 'in_review' | 'action_required' | 'failed' | 'done'
export interface OnboardingState {
    verify: VerifyRowStatus
    addMoneyDone: boolean
    firstPaymentDone: boolean
    firstPaymentRoute: FirstPaymentRoute
    cardHeld?: boolean
    step: 'verify' | 'add_money' | 'first_payment' | 'completed'
}
export interface VerifyRowInput {
    status: 'not_started' | 'processing' | 'action_required' | 'failed' | 'verified' | undefined
    isTerminalFailure?: boolean
    isRegionRestricted?: boolean
    canTransact?: boolean
}
export interface OnboardingInput {
    identity: VerifyRowInput
    milestone: 'registered' | 'verified' | 'funded' | 'activated' | null | undefined
    isActivated: boolean
    holdsMoney: boolean | null | undefined
    firstPaymentRoute: FirstPaymentRoute
    cardHeld: boolean
}
export function verifyRowStatus(input: VerifyRowInput): VerifyRowStatus {
    if (input.status === 'verified' || input.canTransact) return 'done'
    if (input.status === 'processing') return 'in_review'
    if (input.isTerminalFailure || input.isRegionRestricted) return 'failed'
    if (input.status === 'action_required' || input.status === 'failed') return 'action_required'
    return 'todo'
}
export function resolveOnboarding(input: OnboardingInput & { holdsMoney: boolean }): OnboardingState
export function resolveOnboarding(input: OnboardingInput): OnboardingState | null
export function resolveOnboarding(input: OnboardingInput): OnboardingState | null {
    const verify = verifyRowStatus(input.identity)
    const funded = input.isActivated || input.milestone === 'funded' || input.milestone === 'activated'
    if (!funded && input.holdsMoney == null) return null
    const addMoneyDone = funded || !!input.holdsMoney
    const firstPaymentDone = input.isActivated
    let step: OnboardingState['step']
    if (firstPaymentDone) step = 'completed'
    else if (verify === 'todo' || verify === 'action_required' || verify === 'failed') step = 'verify'
    else if (!addMoneyDone) step = 'add_money'
    else if (input.firstPaymentRoute !== 'none') step = 'first_payment'
    else step = verify === 'done' ? 'completed' : 'verify'
    return {
        verify,
        addMoneyDone,
        firstPaymentDone,
        firstPaymentRoute: input.firstPaymentRoute,
        cardHeld: input.cardHeld,
        step,
    }
}

export interface PathCapabilities {
    features: { card: { state: string }; qr: { state: string; action?: string; reason?: string } }
    rails: Array<{ channel: string; status: string; operations?: { pay?: string } }>
    nextActions: Array<{ key: string; kind: string }>
}
export function routeFromCapabilities(
    capabilities: PathCapabilities | null,
    cardPromotionDisabled?: boolean
): {
    route: FirstPaymentRoute
    cardHeld: boolean
    canTransact: boolean
    canSpendViaCard?: boolean
    canPayQr?: boolean
} {
    if (!capabilities) return { route: 'pending', cardHeld: false, canTransact: false }
    const cardRails = capabilities.rails.filter((rail) => rail.channel === 'card')
    const cardHeld = cardRails.some((rail) => rail.status === 'enabled' || rail.status === 'pending')
    const canTransact = capabilities.rails.some((rail) => rail.status === 'enabled')
    const issued = cardRails.some((rail) => rail.operations?.pay === 'enabled')
    const cardUnavailable = capabilities.features.card.state === 'refused' && !issued && !cardHeld
    const canSpendViaCard =
        cardPromotionDisabled === true || cardUnavailable
            ? false
            : cardPromotionDisabled === false && issued
              ? true
              : undefined
    const qr = capabilities.features.qr
    const qrAction = capabilities.nextActions.find((action) => action.key === qr.action)
    let canPayQr: boolean | undefined
    if (qr.state === 'refused')
        canPayQr = qr.reason !== 'identity_region_restricted' && qrAction?.kind === 'restart-identity'
    else if (qr.state === 'action_required') canPayQr = qr.action === 'verify' || qrAction?.kind !== 'provide-email'
    else if (['on', 'ready', 'setting_up', 'pending'].includes(qr.state)) canPayQr = true
    const route: FirstPaymentRoute =
        canSpendViaCard === undefined || canPayQr === undefined
            ? 'pending'
            : canSpendViaCard
              ? canPayQr
                  ? 'card_qr'
                  : 'card'
              : canPayQr
                ? 'qr'
                : 'none'
    return { route, cardHeld, canTransact, canSpendViaCard, canPayQr }
}

export function onboardingIdentity(identity: {
    status: NonNullable<VerifyRowInput['status']>
    canRetry?: boolean
    reason?: { code: string }
    rejectType?: string | null
    rejectLabels?: string[]
}): VerifyRowInput {
    const isRegionRestricted = identity.status === 'failed' && identity.reason?.code === 'identity_region_restricted'
    const terminalLabels = new Set([
        'DOCUMENT_FAKE',
        'FORGERY',
        'GRAPHIC_EDITOR_USAGE',
        'GRAPHIC_EDITOR',
        'AGE_BELOW_ACCEPTED_LIMIT',
        'AGE_REQUIREMENT_MISMATCH',
        'FRAUDULENT_PATTERNS',
        'FRAUDULENT_LIVENESS',
        'BLOCKLIST',
        'ADVERSE_MEDIA',
        'CRIMINAL',
        'COMPROMISED_PERSONS',
        'PEP',
        'SANCTIONS',
        'DUPLICATE',
        'WRONG_USER_REGION',
        'REGULATIONS_VIOLATIONS',
    ])
    const finalRejection = identity.rejectType === 'FINAL' || identity.rejectType === 'PROVIDER_FINAL'
    const retryable = identity.rejectType === 'RETRY' || identity.rejectType === 'PROVIDER_FIXABLE'
    const isTerminalFailure =
        (identity.status === 'failed' && identity.canRetry !== true && !isRegionRestricted) ||
        (identity.status === 'action_required' &&
            (finalRejection || (!retryable && !!identity.rejectLabels?.some((label) => terminalLabels.has(label)))))
    return { status: identity.status, isRegionRestricted, isTerminalFailure }
}
