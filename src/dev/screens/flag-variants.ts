// Literal keys keep posthog-js out of the capture harness; flag-variants.test.ts checks them against the app.
type FlagValue = boolean | string

/**
 * Captures run with no PostHog, so every screen shows each flag's baseline value. Each variant captures a
 * screen again with one flag set, on a screen that reads it and shows the difference; the capture fails if
 * the screen never reads the flag.
 */
export const FLAG_VARIANTS: ReadonlyArray<{ base: string; flag: string; value: FlagValue }> = [
    // The checklist's first-payment row drops the card and offers only QR.
    { base: 'fixture-home-verify-processing', flag: 'card-promotion-disabled', value: true },
]

/** Every value each flag can take, and the one captures show when no variant sets it. */
export const FLAGS: Record<string, { values: ReadonlyArray<FlagValue>; baseline: FlagValue }> = {
    'card-promotion-disabled': { values: [true, false], baseline: false },
    'landing-card-fold-disabled': { values: [true, false], baseline: false },
    'push-provisioning-apple': { values: [true, false], baseline: false },
    'push-provisioning-google': { values: [true, false], baseline: false },
    session_key_spend_sign: { values: [true, false], baseline: false },
    // Read with nonProdBypass, which turns it on in every non-production build.
    'user-interviews-invite': { values: [true, false], baseline: true },
    'signup-rollout-inviter-suggestions': { values: [true, false], baseline: false },
    'stuck-buddy-interventions': { values: [true, false], baseline: false },
}

/** Flags no capture can show, and why. */
export const FLAG_EXEMPTIONS: Record<string, string> = {
    session_key_spend_sign: 'Changes how a spend is signed; nothing on screen differs.',
    'push-provisioning-apple': 'Add-to-wallet exists only in the native apps; captures run the web build.',
    'push-provisioning-google': 'Add-to-wallet exists only in the native apps; captures run the web build.',
    'landing-card-fold-disabled': 'The marketing homepage is not in the Screen Library.',
    'signup-rollout-inviter-suggestions':
        'The suggest route does not exist yet (TASK-24908), so no capture can show the chips; the flag stays off until it ships.',
    'user-interviews-invite':
        'No fixture reaches the invite: even fixture-home-activated, which reads the flag, shows no invite card with it on.',
    'stuck-buddy-interventions':
        'Driven by runtime friction signals and shadow scoring; no static capture fixture triggers the buddy.',
}
