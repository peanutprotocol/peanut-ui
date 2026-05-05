// Build-time harness gate. Next.js inlines `process.env.NEXT_PUBLIC_*` at
// compile time, so in prod builds this evaluates to `false` and every `if
// (HARNESS_ENABLED)` branch becomes dead code the bundler can drop. Harness
// imports do not ship to prod.
export const HARNESS_ENABLED = process.env.NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK === 'true'
