#!/usr/bin/env node
// Records one store upload as the PostHog event `store_build_submitted`.
//
// ios-release.yml and android-release.yml run this right after their store
// upload succeeds. The App Store Connect API keeps no state history and Play
// track status is not exported, so this event is the only record of when a
// build reached each store. The "What is live" tile on the Product health board
// starts its store clock here.
//
// Server-side capture with a fixed system distinct_id and no person profile.
// The uuid comes from platform + build, so a retried step records the build once.
//
// Env: PLATFORM (ios | android), VERSION, BUILD, COMMIT, RUN_URL, TRACK, POSTHOG_KEY.
// Usage:
//   node scripts/store-build-event.mjs            # send
//   node scripts/store-build-event.mjs --dry-run  # print the event, send nothing

import { createHash } from 'node:crypto'

const INGEST_URL = 'https://eu.i.posthog.com/i/v0/e/'
const PLATFORMS = ['ios', 'android']

function deterministicUuid(key) {
    const hex = createHash('sha256').update(key).digest('hex')
    const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function buildEvent(env, now) {
    const platform = env.PLATFORM
    if (!PLATFORMS.includes(platform)) throw new Error(`PLATFORM must be ios or android, got "${platform ?? ''}"`)
    for (const name of ['VERSION', 'BUILD', 'COMMIT']) {
        if (!env[name]) throw new Error(`${name} is empty`)
    }
    return {
        event: 'store_build_submitted',
        distinct_id: 'peanut-ui-release',
        uuid: deterministicUuid(`store_build_submitted:${platform}:${env.BUILD}`),
        timestamp: now.toISOString(),
        properties: {
            $process_person_profile: false,
            platform,
            version: env.VERSION,
            build: env.BUILD,
            commit: env.COMMIT,
            track: env.TRACK || null,
            workflow_run_url: env.RUN_URL || null,
        },
    }
}

async function main() {
    const event = buildEvent(process.env, new Date())
    if (process.argv.includes('--dry-run')) {
        console.log(JSON.stringify(event))
        return
    }
    if (!process.env.POSTHOG_KEY) throw new Error('POSTHOG_KEY is empty')
    const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.POSTHOG_KEY, ...event }),
        signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`PostHog capture: HTTP ${res.status}`)
    console.log(
        `store_build_submitted: ${event.properties.platform} ${event.properties.version} (${event.properties.build})`
    )
}

main().catch((error) => {
    // The upload already succeeded; a missing analytics event must not fail the release.
    console.log(`::warning::store_build_submitted not recorded: ${error.message}`)
    process.exit(1)
})
