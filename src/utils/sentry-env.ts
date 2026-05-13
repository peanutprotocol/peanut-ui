/**
 * Returns the Sentry `environment` tag for the current build, so issues from
 * staging / production / preview / native / local are filterable in Sentry.
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
