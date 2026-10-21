import posthog, { type CaptureResult } from 'posthog-js'
import {
    AUTOCAPTURE_SAMPLE_RATE_FLAG,
    AUTOCAPTURE_SETTINGS,
    autocaptureLinkTarget,
    autocaptureSampleRate,
    redactAutocaptureLinks,
    sampleAutocapture,
    trackAutocaptureSampleRate,
} from '../posthog-autocapture'

const event = (name: string) => ({ event: name, properties: { $el_text: 'Continue' } }) as unknown as CaptureResult

describe('autocaptureSampleRate', () => {
    it.each([
        [0.25, 0.25],
        [0, 0],
        [1, 1],
        [1.5, 1],
        [-0.2, 0],
    ])('reads the number payload %p as %p', (payload, rate) => {
        expect(autocaptureSampleRate(payload)).toBe(rate)
    })

    it.each([undefined, null, '0.2', '', { rate: 0.2 }, Number.NaN, true])(
        'keeps every event for a payload that is not a number: %p',
        (payload) => {
            expect(autocaptureSampleRate(payload)).toBe(1)
        }
    )
})

describe('sampleAutocapture', () => {
    it('drops $autocapture events above the rate and keeps the ones below it', () => {
        const kept = event('$autocapture')
        expect(sampleAutocapture(kept, 0.3, () => 0.29)).toBe(kept)
        expect(sampleAutocapture(event('$autocapture'), 0.3, () => 0.3)).toBeNull()
        expect(sampleAutocapture(event('$autocapture'), 0, () => 0)).toBeNull()
    })

    it.each(['$pageview', '$exception', '$rageclick', 'card_gate_step_viewed', '$identify'])(
        'never samples %s',
        (name) => {
            const kept = event(name)
            expect(sampleAutocapture(kept, 0, () => 0.99)).toBe(kept)
        }
    )

    it('keeps everything at rate 1 and passes a dropped event through', () => {
        const kept = event('$autocapture')
        expect(sampleAutocapture(kept, 1, () => 0.99)).toBe(kept)
        expect(sampleAutocapture(null, 0)).toBeNull()
    })
})

describe('autocaptureLinkTarget', () => {
    const page = 'https://peanut.me/request/pay?amount=5'
    it.each([
        ['/home?tab=activity#top', page, '/home'],
        ['https://peanut.me/send/alice?amount=20', page, '/send/alice'],
        ['https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig', page, 'https://storage.example.com'],
        ['mailto:alice@example.com', page, 'mailto://'],
        ['/card?card_step=funding', 'capacitor://localhost/home', '/card'],
        ['https://peanut.me/home', 'capacitor://localhost/home', 'https://peanut.me'],
        ['http://[bad', page, ''],
    ])('cuts %s on %s to %s', (href, pageUrl, expected) => {
        expect(autocaptureLinkTarget(href, pageUrl)).toBe(expected)
    })
})

describe('redactAutocaptureLinks', () => {
    const page = 'https://peanut.me/history'
    it('cuts every link target in the elements chain, the elements list and the external click URL', () => {
        const doc = 'https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig'
        const event = {
            event: '$autocapture',
            properties: {
                $elements_chain: `a.flex:attr__href="${doc}"href="${doc}"nth-child="1";div:nth-child="2";a:attr__href="/send/alice?amount=5"`,
                $elements: [{ tag_name: 'a', attr__href: doc }, { tag_name: 'div' }],
                $external_click_url: doc,
            },
        } as unknown as CaptureResult
        redactAutocaptureLinks(event, page)
        expect(event.properties).toEqual({
            $elements_chain:
                'a.flex:attr__href="https://storage.example.com"href="https://storage.example.com"nth-child="1";div:nth-child="2";a:attr__href="/send/alice"',
            $elements: [{ tag_name: 'a', attr__href: 'https://storage.example.com' }, { tag_name: 'div' }],
            $external_click_url: 'https://storage.example.com',
        })
    })

    it('leaves other events alone', () => {
        const event = {
            event: '$pageview',
            properties: { $external_click_url: 'https://x.example/a?b=c' },
        } as unknown as CaptureResult
        expect(redactAutocaptureLinks(event, page)).toEqual({
            event: '$pageview',
            properties: { $external_click_url: 'https://x.example/a?b=c' },
        })
    })
})

describe('trackAutocaptureSampleRate', () => {
    it('reads the payload without a $feature_flag_called event and applies it to later events', () => {
        let onFlags: () => void = () => {}
        const getFeatureFlagResult = jest.fn(() => ({ payload: 0 }))
        trackAutocaptureSampleRate({
            onFeatureFlags: (callback: () => void) => {
                onFlags = callback
                return () => {}
            },
            getFeatureFlagResult,
        } as never)

        // Before flags load, every event is kept.
        const early = event('$autocapture')
        expect(sampleAutocapture(early)).toBe(early)

        onFlags()
        expect(getFeatureFlagResult).toHaveBeenCalledWith(AUTOCAPTURE_SAMPLE_RATE_FLAG, { send_event: false })
        expect(sampleAutocapture(event('$autocapture'))).toBeNull()

        // The flag is switched off: no payload, keep all again.
        getFeatureFlagResult.mockReturnValue(undefined as never)
        onFlags()
        const late = event('$autocapture')
        expect(sampleAutocapture(late)).toBe(late)
    })
})

/*
 * Runs the installed posthog-js with these settings in jsdom, so an SDK upgrade
 * that changes what a click sends fails here instead of in production.
 */
describe('posthog-js with AUTOCAPTURE_SETTINGS', () => {
    const captured: CaptureResult[] = []
    beforeAll(() => {
        posthog.init(
            'phc_test',
            {
                api_host: 'https://eu.i.posthog.com',
                persistence: 'memory',
                capture_pageview: false,
                capture_pageleave: false,
                disable_session_recording: true,
                advanced_disable_flags: true,
                rageclick: false,
                ...AUTOCAPTURE_SETTINGS,
                before_send: (event) => {
                    const redacted = redactAutocaptureLinks(event, window.location.href)
                    if (redacted) captured.push(redacted)
                    return null // nothing leaves the test
                },
            },
            'autocapture-settings'
        )
    })
    beforeEach(() => {
        captured.length = 0
        document.body.innerHTML = `
            <div aria-label="Wallet of alice">
                <button id="max" aria-label="Use your balance: 123.45 USD"><span>123.45 USD</span></button>
                <a id="link" href="/home?ref=alice" title="alice's home">Home of alice</a>
                <a id="doc" href="https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig" target="_blank">receipt-alice.pdf</a>
                <button id="secret" class="ph-no-capture">Reveal</button>
                <input id="field" value="9876" />
                <div id="plain">Just text</div>
            </div>`
    })
    const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const autocaptured = () => captured.filter((event) => event.event === '$autocapture')

    it('sends a button click without its text or attributes', () => {
        click('max')
        expect(autocaptured()).toHaveLength(1)
        const sent = JSON.stringify(autocaptured()[0])
        expect(sent).not.toContain('123.45')
        expect(sent).not.toContain('alice')
        expect(autocaptured()[0].properties.$elements_chain).toMatch(/^button/)
    })

    it('keeps the link target but not the link text or title', () => {
        click('link')
        expect(autocaptured()).toHaveLength(1)
        expect(autocaptured()[0].properties.$elements_chain).toContain('attr__href="/home"')
        expect(JSON.stringify(autocaptured()[0])).not.toContain('alice')
    })

    it('sends only the host of an external link, such as an uploaded attachment', () => {
        click('doc')
        expect(autocaptured()).toHaveLength(1)
        const sent = JSON.stringify(autocaptured()[0])
        expect(sent).toContain('https://storage.example.com')
        expect(sent).not.toContain('uploads')
        expect(sent).not.toContain('receipt')
        expect(sent).not.toContain('s3cr3tSig')
    })

    it('ignores ph-no-capture elements, inputs and other elements', () => {
        click('secret')
        click('plain')
        const field = document.getElementById('field') as HTMLInputElement
        field.dispatchEvent(new Event('change', { bubbles: true }))
        click('field')
        expect(autocaptured()).toEqual([])
    })
})
