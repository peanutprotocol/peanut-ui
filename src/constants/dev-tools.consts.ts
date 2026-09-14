// Build-time gate for the /dev/devices viewport harness. Next.js inlines
// `process.env.NEXT_PUBLIC_*` at compile time, so a production build folds this
// to `false` and the harness never ships. Preview builds keep it, so a PR can
// be reviewed across device widths on its own vercel URL.
//
// Both the page and the in-pane agent read this constant. They must agree — a
// page that renders without an agent in the panes is a dead harness.
export const DEV_TOOLS_ENABLED =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

// Where the /dev pages may answer. peanut.me is the only host that blocks them;
// localhost, staging and vercel previews keep every tool. A build with no
// NEXT_PUBLIC_BASE_URL reads as peanut.me, so the gate fails closed.
// Cannot import BASE_URL from general.consts — that module pulls in viem and
// proxy.ts runs on the edge.
export const DEV_ROUTES_ENABLED =
    DEV_TOOLS_ENABLED || (process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me') !== 'https://peanut.me'

// The /dev routes that stay reachable on peanut.me. payment-graph is the
// activity visualisation shown at events. full-graph is deliberately absent:
// the legacy page loads the same team-gated dataset without the explorer's
// telemetry suppression. safe-area reads device insets and must run on the
// production native build, where the bad insets are.
const PROD_ALLOWED_DEV_ROUTES = ['/dev/payment-graph', '/dev/safe-area']

// True for any /dev path that must not answer on peanut.me. One check for both
// route groups — `src/app/dev/*` and `src/app/(mobile-ui)/dev/*`.
export function isBlockedDevRoute(pathname: string): boolean {
    if (pathname !== '/dev' && !pathname.startsWith('/dev/')) return false
    return !PROD_ALLOWED_DEV_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

// The one call every gate makes — proxy.ts on the web, the two dev layouts on
// the native static export. The flag and the predicate are only meaningful
// together; a call site that uses isBlockedDevRoute alone would 404 dev
// tooling on staging and previews.
export function shouldBlockDevRoute(pathname: string): boolean {
    return !DEV_ROUTES_ENABLED && isBlockedDevRoute(pathname)
}
