/** @jest-environment jsdom */

/*
 * Acceptance tests for the /setup entry decision in the reordered signup
 * (spec: signup-reorder-spec.md, failure 9). The page-level behaviour (the
 * screen actually shown, the invite kept, Invite hidden) is covered in
 * src/app/(setup)/setup/__tests__/setup-flow.acceptance.test.tsx; this file
 * pins the pure resolver.
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - resolveSetupEntryStep keeps its name and SetupEntryInput keeps today's
 *   fields. It may gain more (for example the runtime screen ids) and may
 *   return a token instead of a ScreenId for "the first screen after
 *   Welcome"; the inputs below are cast so either shape compiles. Pass
 *   `screenIds` if the resolver needs the list: it is provided here.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The web landing gate, known-device and ?step=login cases are regression
 * guards: they pass today and must keep passing.
 */

import { resolveSetupEntryStep, type SetupEntryInput } from '../setup-entry'

const SCREEN_IDS = [
    'landing',
    'advantage-fees',
    'advantage-card',
    'residence',
    'payment-plan',
    'signup',
    'passkey',
    'notification-email',
    'notification-permission',
    'advantage-control',
]

const input = (overrides: Partial<SetupEntryInput>) =>
    ({
        hasInviteCode: false,
        stepParam: null,
        webSignupClosed: false,
        knownDevice: false,
        screenIds: SCREEN_IDS,
        ...overrides,
    }) as SetupEntryInput

describe('invite link / ?step=signup entry (failure 9)', () => {
    it.each([
        ['an invite code', { hasInviteCode: true }],
        ['?step=signup', { stepParam: 'signup' }],
        ['both', { hasInviteCode: true, stepParam: 'signup' }],
    ])('with %s, skips Welcome but never opens Claim username first', (_label, overrides) => {
        const entry = resolveSetupEntryStep(input(overrides)) as string
        expect(entry).not.toBe('signup')
        expect(entry).not.toBe('landing')
    })
})

describe('unchanged gates (regression guards)', () => {
    it.each([
        ['an invite code', { hasInviteCode: true }],
        ['?step=signup', { stepParam: 'signup' }],
    ])('web signup closed: %s still lands on Welcome', (_label, overrides) => {
        expect(resolveSetupEntryStep(input({ ...overrides, webSignupClosed: true }))).toBe('landing')
    })

    it.each([
        ['an invite code', { hasInviteCode: true }],
        ['?step=signup', { stepParam: 'signup' }],
    ])('a known device with %s lands on Welcome (Log In)', (_label, overrides) => {
        expect(resolveSetupEntryStep(input({ ...overrides, knownDevice: true }))).toBe('landing')
    })

    it('?step=login lands on Welcome even with an invite code', () => {
        expect(resolveSetupEntryStep(input({ stepParam: 'login', hasInviteCode: true }))).toBe('landing')
    })

    it('a plain entry lands on Welcome', () => {
        expect(resolveSetupEntryStep(input({}))).toBe('landing')
    })
})
