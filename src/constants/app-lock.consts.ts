// Master switch for the native app-OPEN lock (issue #2472 / PR #2489).
//
// Off by default: opening the app and viewing the balance is NOT gated behind
// a biometric, matching the web app where the same read-only view is ungated.
// We treat "someone opens the app and sees a balance" as non-critical; the
// controls that matter — moving money — stay passkey-gated at the transaction
// layer, independently of this flag.
//
// The biometric-guarded token infrastructure (secure-token-store.ts, the
// 'guarded' session mode, AppLockGate) stays fully in the codebase but is
// dormant when this is false: sessions keep the JWT in plain Preferences so the
// app opens silently and no lock screen renders.
//
// Set NEXT_PUBLIC_APP_OPEN_GATED=true to re-engage the lock — the JWT then
// moves into biometric-guarded Keychain/Keystore and opening the app requires a
// biometric assertion. Next.js inlines `process.env.NEXT_PUBLIC_*` at compile
// time, so a default build keeps the gate off.
export const OPEN_GATED = process.env.NEXT_PUBLIC_APP_OPEN_GATED === 'true'
