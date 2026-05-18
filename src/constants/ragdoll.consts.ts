// Build-time kill-switch for the rewards-screen ragdoll easter egg.
// On by default; set NEXT_PUBLIC_RAGDOLL_ENABLED=false to disable. Next.js
// inlines `process.env.NEXT_PUBLIC_*` at compile time, so a `false` build
// dead-code-eliminates the `dynamic(() => import(...))` and tree-shakes the
// ragdoll chunk + p2-es out entirely.
export const RAGDOLL_ENABLED = process.env.NEXT_PUBLIC_RAGDOLL_ENABLED !== 'false'
