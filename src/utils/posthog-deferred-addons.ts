import type { PostHog, PostHogConfig } from 'posthog-js'

/*
 * On the marketing site, PostHog's add-on scripts (surveys, heatmaps with its
 * dead-click detector) and the session recorder load through `/relay` during
 * page load: about 60 ms of blocking time and 680 ms of main-thread work on
 * the landing page. They start after the `load` event and an idle moment
 * instead. Core capture, `$pageview`, attribution, web vitals and exception
 * capture stay as eager as before, so nothing that measures growth moves.
 *
 * Not deferred to the first interaction: a visitor who bounces without
 * touching the page still gets a replay.
 */

/** Init overrides for a marketing document; `releaseDeferredAddons` lifts them. */
export const DEFERRED_ADDONS_INIT = {
    disable_surveys: true,
    // posthog-js loads the dead-click script for heatmaps whenever heatmaps
    // are on, so heatmaps wait too or the script still loads at init.
    capture_heatmaps: false,
    capture_dead_clicks: false,
} satisfies Partial<PostHogConfig>

type RemoteConfigResult = Parameters<NonNullable<PostHog['surveys']>['onRemoteConfig']>[0]

/*
 * posthog-js 1.428 publishes the remote config to its extensions on this
 * internal event. While `disable_surveys` is set the surveys extension ignores
 * that result, and re-enabling the option later does not replay it, so the
 * result is kept here and handed over on release. Without it (a renamed event
 * after an upgrade) surveys stay off for this document: nothing breaks, they
 * are switched off server-side today.
 */
const REMOTE_CONFIG_EVENT = 'extensionsRemoteConfig'

/** Starts keeping the latest remote config. Call right after `posthog.init`. */
export function rememberRemoteConfig(posthog: PostHog): () => RemoteConfigResult | undefined {
    let latest: RemoteConfigResult | undefined
    const on = posthog.on.bind(posthog) as unknown as (
        event: string,
        handler: (result: RemoteConfigResult) => void
    ) => () => void
    on(REMOTE_CONFIG_EVENT, (result) => {
        latest = result
    })
    return () => latest
}

/** Gives surveys, heatmaps and dead clicks back to the remote config, as on app routes. */
export function releaseDeferredAddons(posthog: PostHog, remoteConfig: RemoteConfigResult | undefined): void {
    // `set_config` skips undefined values, so the client overrides are removed
    // here and the set_config below re-runs each add-on's own enable check.
    posthog.config.capture_heatmaps = undefined
    posthog.config.capture_dead_clicks = undefined
    posthog.set_config({ disable_surveys: false })
    if (remoteConfig) posthog.surveys?.onRemoteConfig(remoteConfig)
}

/**
 * Runs `run` once the window has loaded and the browser is idle, or 2 s after
 * load when it never goes idle (or has no requestIdleCallback).
 */
export function afterLoadIdle(run: () => void, timeout = 2000): void {
    if (typeof window === 'undefined') return

    const idle = () => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => run(), { timeout })
        } else {
            window.setTimeout(run, timeout)
        }
    }

    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
}
