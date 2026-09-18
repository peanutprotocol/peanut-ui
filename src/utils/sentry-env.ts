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
 * The environments we pay Sentry for. Every build reports into the same
 * project, so ad-hoc PR previews and local builds were billed alongside
 * production and mixed into its issues — 2,649 error + 1,374 warning events
 * from `preview` in 30 days, plus 336 from `development`, that nobody reads.
 */
const REPORTING_ENVIRONMENTS = new Set(['production', 'native', 'staging'])

export function isSentryReportingEnvironment(): boolean {
    return REPORTING_ENVIRONMENTS.has(inferSentryEnvironment())
}
