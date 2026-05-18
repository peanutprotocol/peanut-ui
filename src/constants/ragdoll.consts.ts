// Build-time gate for the rewards-screen ragdoll easter egg. Next.js inlines
// `process.env.NEXT_PUBLIC_*` at compile time, so when this is false every
// `if (RAGDOLL_ENABLED)` and the `dynamic(() => import(...))` behind it become
// dead code the bundler drops. The ragdoll chunk + p2-es never ship in
// flag-off builds. Mirrors the harness gate in `harness.consts.ts`.
export const RAGDOLL_ENABLED = process.env.NEXT_PUBLIC_RAGDOLL_ENABLED === 'true'
