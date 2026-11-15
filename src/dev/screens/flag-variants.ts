// Literal keys keep posthog-js out of the capture harness; flag-variants.test.ts checks them against the app.
type FlagValue = boolean | string

/**
 * Captures run with no PostHog, so every screen shows each flag's baseline value. Each variant captures a
 * screen again with one flag set, on a screen that reads it and shows the difference; the capture fails if
 * the screen never reads the flag.
 */
export const FLAG_VARIANTS: ReadonlyArray<{ base: string; flag: string; value: FlagValue }> = [
    { base: '01-a-landing', flag: 'welcome-headline-copy', value: 'every_border' },
    { base: '01-a-landing', flag: 'welcome-headline-copy', value: 'whole_world' },
    { base: '01-a-landing', flag: 'welcome-headline-copy', value: 'travels_free' },
    { base: '07-d-notification-settings', flag: 'signup-notification-switches', value: 'switches' },
    { base: '07-d-notification-settings', flag: 'signup-notification-switches', value: 'defaults_on' },
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
    'signup-notification-switches': { values: ['control', 'switches', 'defaults_on'], baseline: 'control' },
    'welcome-headline-copy': {
        values: ['control', 'every_border', 'whole_world', 'travels_free'],
        baseline: 'control',
    },
}

/** Flags no capture can show, and why. */
export const FLAG_EXEMPTIONS: Record<string, string> = {
    session_key_spend_sign: 'Changes how a spend is signed; nothing on screen differs.',
    'push-provisioning-apple': 'Add-to-wallet exists only in the native apps; captures run the web build.',
    'push-provisioning-google': 'Add-to-wallet exists only in the native apps; captures run the web build.',
    'landing-card-fold-disabled': 'The marketing homepage is not in the Screen Library.',
    'user-interviews-invite':
        'No fixture reaches the invite: even fixture-home-activated, which reads the flag, shows no invite card with it on.',
}
