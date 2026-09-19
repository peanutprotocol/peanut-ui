/**
 * Returns the Sentry `environment` tag for the current build, so issues from
 * the environments we report from are filterable in Sentry. It also decides
 * which those are — see `isSentryReportingEnvironment` below.
 *
 * Without this every Vercel build defaulted to NODE_ENV=production and all
 * events tagged "production" — `environment:staging` queries returned zero
 * results. Vercel auto-exposes VERCEL_ENV + VERCEL_GIT_COMMIT_REF; we
 * re-export them as NEXT_PUBLIC_* in next.config.js so they survive into
 * the client bundle.
 */
export function inferSentryEnvironment(): string {
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true') return 'native'

    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
    if (vercelEnv === 'production') return 'production'
    if (vercelEnv === 'preview') {
        // The `dev` branch is aliased to staging.peanut.me — that's the QA
        // env. Every other branch is an ad-hoc PR preview.
        return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === 'dev' ? 'staging' : 'preview'
    }
    return 'development'
}

/**
 * Every environment we report from — that is, all of them but a local build.
 *
 * This is stricter than the `NODE_ENV !== 'development'` guard it replaces: a
 * `next build` on a laptop runs with NODE_ENV=production and no VERCEL_ENV, so
 * it used to report as `production` and be billed there (336 events in 30
 * days). It infers `development` here instead, and reports nothing.
 *
 * `preview` deliberately stays on. The OTA liveness proof in
 * ops/native-ota-envless-bundle-rca.md reads preview and canary events out of
 * Sentry, so a dark preview would take a diagnostic with it.
 */
export function isSentryReportingEnvironment(): boolean {
    return inferSentryEnvironment() !== 'development'
}
