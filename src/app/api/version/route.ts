import { NextResponse } from 'next/server'

/**
 * The commit of the deployment serving this request.
 *
 * NEXT_PUBLIC_GIT_COMMIT_HASH is inlined at build time (next.config.js), so a
 * client bundle carries the hash of the deployment it was built from while this
 * route — always executed by whichever deployment is live — returns the current
 * one. The mismatch is what useStaleDeploymentReload keys off.
 *
 * force-dynamic + no-store on purpose: a cached response would report a stale
 * deployment as current and defeat the whole check. Next already emits its own
 * no-store for dynamic routes and wins on the wire; the explicit header is the
 * declaration of intent and the fallback if this route ever stops being dynamic.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
    return NextResponse.json(
        { commit: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH ?? 'unknown' },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
}
