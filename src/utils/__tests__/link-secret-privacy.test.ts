import posthog, { type CaptureResult, type CapturedNetworkRequest, type PostHogConfig } from 'posthog-js'
import { LazyLoadedSessionRecording } from 'posthog-js/lib/src/extensions/replay/external/lazy-loaded-session-recorder'
import { buildNetworkRequestOptions } from 'posthog-js/lib/src/extensions/replay/external/config'
import type { ErrorEvent } from '@sentry/nextjs'
import {
    maskLinkSecretsInReplayRequest,
    redactLinkSecrets,
    stripLinkSecrets,
    stripUrlSecrets,
} from '../link-secret-privacy'
import { maskQrReplayRequest } from '../qr-telemetry-privacy'
import { beforeSendHandler, beforeSendRouteAwareTransaction } from '../../../sentry.utils'

const SECRET = 'fakeClaimSecret0123'
const CLAIM_PATH = '/claim?c=42161&v=v4.4&i=552'
const claimUrls = [
    `https://peanut.me${CLAIM_PATH}#p=${SECRET}`,
    `capacitor://localhost${CLAIM_PATH.replace('/claim', '/claim/')}#p=${SECRET}`,
    `${CLAIM_PATH}#p=${SECRET}`,
]
// The claim CTA's hand-off: /setup?redirect_uri=<encoded path + query + hash>.
const setupRedirect = `/setup?redirect_uri=${encodeURIComponent(`${CLAIM_PATH}#p=${SECRET}`)}`
const inviteRedirect = `/invite?code=alice&redirect_uri=${encodeURIComponent(setupRedirect)}&step=1`
// The same replay network entry the default QR mask, then the link mask, sees.
const replayMask = (request: CapturedNetworkRequest) => maskLinkSecretsInReplayRequest(maskQrReplayRequest(request))

describe('stripLinkSecrets', () => {
    it.each(claimUrls)('drops the #p= fragment and keeps c, v and i: %s', (url) => {
        const stripped = stripLinkSecrets(url)
        expect(stripped).not.toContain(SECRET)
        expect(stripped).toBe(url.split('#')[0])
    })

    it.each([
        [setupRedirect, `/setup?redirect_uri=${encodeURIComponent(CLAIM_PATH)}`],
        [`${setupRedirect}&lang=es`, `/setup?redirect_uri=${encodeURIComponent(CLAIM_PATH)}&lang=es`],
        [
            inviteRedirect,
            `/invite?code=alice&redirect_uri=${encodeURIComponent(`/setup?redirect_uri=${encodeURIComponent(CLAIM_PATH)}`)}&step=1`,
        ],
        [`Claim failed for ${claimUrls[0]} (404)`, `Claim failed for https://peanut.me${CLAIM_PATH} (404)`],
    ])('drops the secret when it is percent-encoded or inside text: %s', (value, expected) => {
        expect(stripLinkSecrets(value)).toBe(expected)
    })

    it.each([
        'https://peanut.me/home?tab=activity',
        `https://peanut.me${CLAIM_PATH}`,
        '/request?amount=5&chargeId=abc',
        'https://peanut.me/#regulated-rails',
        'Pay #3 of 4 with 100% of the balance',
    ])('leaves a value without a link secret unchanged: %s', (value) => {
        expect(stripLinkSecrets(value)).toBe(value)
    })

    it('drops any fragment from a URL', () => {
        expect(stripUrlSecrets('https://peanut.me/page?x=1#access_token=abc')).toBe('https://peanut.me/page?x=1')
    })
})

describe('redactLinkSecrets', () => {
    it('removes the secret from every URL property of a PostHog event', () => {
        const event = {
            event: 'claim_link_viewed',
            properties: {
                $current_url: claimUrls[0],
                $referrer: claimUrls[0],
                $initial_current_url: claimUrls[1],
                $session_entry_url: claimUrls[0],
                $pathname: '/claim',
                $set: { $current_url: claimUrls[0] },
                api_path: setupRedirect,
                nested: [{ navigationURL: claimUrls[2] }],
                chainId: '42161',
            },
            $set: { $current_url: claimUrls[0] },
            $set_once: { $initial_current_url: claimUrls[0], $initial_referrer: '$direct' },
        }
        expect(redactLinkSecrets(event)).toBe(event)
        expect(JSON.stringify(event)).not.toContain(SECRET)
        expect(event.properties.$current_url).toBe(`https://peanut.me${CLAIM_PATH}`)
        expect(event.$set_once.$initial_current_url).toBe(`https://peanut.me${CLAIM_PATH}`)
        expect(event.properties).toMatchObject({ $pathname: '/claim', chainId: '42161' })
    })

    it('leaves an event without a secret unchanged', () => {
        const event = {
            event: '$pageview',
            properties: { $current_url: 'https://peanut.me/home?tab=1', $referrer: '$direct', count: 3, ok: true },
            $set_once: { $initial_current_url: 'https://peanut.me/' },
        }
        const before = JSON.parse(JSON.stringify(event))
        expect(redactLinkSecrets(event)).toEqual(before)
    })

    it('scrubs an uncompressed replay Meta event and leaves gzip-compressed replay data untouched', () => {
        const compressed = { type: 2, cv: '2024-10', data: `binary#p=${SECRET}bytes` }
        const snapshot = {
            event: '$snapshot',
            properties: {
                $snapshot_data: [{ type: 4, data: { href: claimUrls[0], width: 375, height: 667 } }, compressed],
            },
        }
        redactLinkSecrets(snapshot)
        expect(snapshot.properties.$snapshot_data[0]).toEqual({
            type: 4,
            data: { href: `https://peanut.me${CLAIM_PATH}`, width: 375, height: 667 },
        })
        expect(compressed.data).toBe(`binary#p=${SECRET}bytes`)
    })
})

describe('posthog-js with the instrumentation-client settings', () => {
    const captured: CaptureResult[] = []
    const record = (event: CaptureResult | null) => {
        if (event) captured.push(event)
        return null // drop it: nothing leaves the test
    }
    const init = (config: Partial<PostHogConfig>, name: string) =>
        posthog.init(
            'phc_test',
            {
                api_host: 'https://eu.i.posthog.com',
                persistence: 'memory',
                autocapture: false,
                capture_pageview: false,
                capture_pageleave: false,
                disable_session_recording: true,
                advanced_disable_flags: true,
                ...config,
            },
            name
        )!

    beforeEach(() => {
        captured.length = 0
        window.history.replaceState(null, '', `${CLAIM_PATH}#p=${SECRET}`)
    })
    afterAll(() => window.history.replaceState(null, '', '/'))

    it('sends the secret when nothing strips it (control)', () => {
        init({ before_send: record }, 'control').capture('claim_link_viewed')
        expect(JSON.stringify(captured)).toContain(SECRET)
    })

    it('sends no secret in $current_url, initial URLs or a custom property', () => {
        const instance = init(
            { disable_capture_url_hashes: true, before_send: [(event) => event && redactLinkSecrets(event), record] },
            'scrubbed'
        )
        instance.capture('claim_link_viewed', { redirect: setupRedirect })
        expect(captured).toHaveLength(1)
        expect(JSON.stringify(captured)).not.toContain(SECRET)
        expect(captured[0].properties.$current_url).toBe(`http://localhost${CLAIM_PATH}`)
    })
})

/*
 * These two call posthog-js internals on purpose: they pin how the installed
 * SDK builds a replay's page URL and network entries. If an upgrade changes
 * that path, this fails instead of a replay leaking the secret.
 */
describe('session replay URLs', () => {
    const sessionRecording = { recordBody: false, recordHeaders: false, maskCapturedNetworkRequestFn: replayMask }

    it.each([...claimUrls, setupRedirect])('the replay Meta event page URL carries no secret: %s', (href) => {
        const recorder = Object.create(LazyLoadedSessionRecording.prototype) as {
            _instance: unknown
            _maskReplayUrl: (url: string) => string
        }
        recorder._instance = { config: { disable_capture_url_hashes: true, session_recording: sessionRecording } }
        const masked = recorder._maskReplayUrl(href)
        expect(masked).not.toContain(SECRET)
        expect(masked).toContain('42161')
    })

    it.each([...claimUrls, setupRedirect])('a recorded network entry carries no secret: %s', (name) => {
        // The deep import types its config from posthog-js/lib, not the package root.
        type InstanceConfig = Parameters<typeof buildNetworkRequestOptions>[0]
        const { maskRequestFn } = buildNetworkRequestOptions(
            { api_host: 'https://eu.i.posthog.com', session_recording: sessionRecording } as unknown as InstanceConfig,
            {}
        )
        const masked = maskRequestFn!({
            name,
            entryType: 'resource',
            initiatorType: 'fetch',
            startTime: 0,
            duration: 1,
            method: 'GET',
            status: 200,
        })
        expect(masked?.name).not.toContain(SECRET)
        expect(masked?.name).toContain('42161')
    })
})

describe('Sentry', () => {
    it('removes the secret from the request URL, breadcrumbs and messages of an error', () => {
        const event = {
            message: `Claim failed for ${claimUrls[0]}`,
            request: { url: claimUrls[0] },
            breadcrumbs: [
                { category: 'navigation', data: { from: claimUrls[2], to: setupRedirect } },
                {
                    category: 'fetch',
                    data: { url: `https://api.peanut.me/send-links?link=${encodeURIComponent(claimUrls[0])}` },
                },
            ],
            exception: { values: [{ type: 'Error', value: `Bad link ${claimUrls[1]}` }] },
        } as unknown as ErrorEvent
        const result = beforeSendHandler(event)
        expect(result).not.toBeNull()
        expect(JSON.stringify(result)).not.toContain(SECRET)
        expect(result?.request?.url).toBe(`https://peanut.me${CLAIM_PATH}`)
    })

    it('removes the secret from a transaction', () => {
        const transaction = { type: 'transaction' as const, transaction: '/claim', request: { url: claimUrls[0] } }
        expect(JSON.stringify(beforeSendRouteAwareTransaction(transaction))).not.toContain(SECRET)
    })
})
