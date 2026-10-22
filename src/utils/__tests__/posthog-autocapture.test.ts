import posthog, { type CaptureResult } from 'posthog-js'
import {
    AUTOCAPTURE_SAMPLE_RATE_FLAG,
    AUTOCAPTURE_SETTINGS,
    autocaptureLinkTarget,
    autocaptureSampleRate,
    redactAutocapture,
    sampleAutocapture,
    scrubAutocaptureText,
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

describe('scrubAutocaptureText', () => {
    it.each([
        ['Card 4111 1111 1111 1111', 'Card **** **** **** ****'],
        ['Call +54 11 1234-5678', 'Call +** ** ****-****'],
        ['CBU 0110599520000001234567', 'CBU **********************'],
        ['CPF 123.456.789-09', 'CPF ***.***.***-**'],
        ['Send $1,250.00', 'Send $*,***.**'],
        ['Mail alice.smith+pay@example.com now', 'Mail [email] now'],
        ['To 0x1234abcd5678ef90', 'To [address]'],
        ['Key sk9f8e7d6c5b4a3f2e1d0c9b', 'Key [token]'],
    ])('masks %p as %p', (text, expected) => {
        expect(scrubAutocaptureText(text)).toBe(expected)
    })

    it.each([
        'Continue',
        'Add money',
        'Send $25 to @alice',
        'Pay $12,500',
        '3 friends joined',
        'Card ending 4242',
        'On 21/10/2026 10:30',
        '2026-10-21',
        'Oct 22, 2026',
        'supercalifragilisticexpialidocious',
    ])('keeps %p', (text) => {
        expect(scrubAutocaptureText(text)).toBe(text)
    })
})

describe('redactAutocapture', () => {
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
        redactAutocapture(event, page)
        expect(event.properties).toEqual({
            $elements_chain:
                'a.flex:attr__href="https://storage.example.com"href="https://storage.example.com"nth-child="1";div:nth-child="2";a:attr__href="/send/alice"',
            $elements: [{ tag_name: 'a', attr__href: 'https://storage.example.com' }, { tag_name: 'div' }],
            $external_click_url: 'https://storage.example.com',
        })
    })

    it('scrubs text and attributes, keeping the words, classes and position', () => {
        const event = {
            event: '$autocapture',
            properties: {
                $el_text: 'Send $1,250.00 to @alice',
                $elements_chain:
                    'button.btn:attr__aria-label="Card 4111 1111 1111 1111"attr__class="btn"attr__title="Mail \\"bob@example.com\\""nth-child="2"nth-of-type="1"text="Send $1,250.00 to @alice";div.row:attr__class="row"nth-child="12345678"',
                $elements: [
                    {
                        tag_name: 'button',
                        $el_text: 'Send $1,250.00 to @alice',
                        classes: ['btn'],
                        attr__class: 'btn',
                        attr__placeholder: '0x1234abcd5678ef90',
                        nth_child: 2,
                    },
                ],
            },
        } as unknown as CaptureResult
        redactAutocapture(event, page)
        expect(event.properties).toEqual({
            $el_text: 'Send $*,***.** to @alice',
            $elements_chain:
                'button.btn:attr__aria-label="Card **** **** **** ****"attr__class="btn"attr__title="Mail \\"[email]\\""nth-child="2"nth-of-type="1"text="Send $*,***.** to @alice";div.row:attr__class="row"nth-child="12345678"',
            $elements: [
                {
                    tag_name: 'button',
                    $el_text: 'Send $*,***.** to @alice',
                    classes: ['btn'],
                    attr__class: 'btn',
                    attr__placeholder: '[address]',
                    nth_child: 2,
                },
            ],
        })
    })

    it('keeps only tag, classes and position inside a ph-sensitive element', () => {
        const event = {
            event: '$autocapture',
            properties: {
                $el_text: 'Alice Smith',
                $elements_chain:
                    'span:nth-child="1"nth-of-type="1"text="Alice Smith";a.row:attr__class="row"attr__href="/alice"attr__title="Alice; Smith"href="/alice"nth-child="3"nth-of-type="3"text="Alice Smith";li.ph-sensitive:attr__class="ph-sensitive"attr__data-name="Alice Smith"nth-child="1"nth-of-type="1";main.page:attr__class="page"attr__aria-label="Wallet 4111111111111111"nth-child="1"nth-of-type="1"',
                $elements: [
                    { tag_name: 'a', $el_text: 'Alice Smith', attr__href: '/alice', classes: ['row'] },
                    { tag_name: 'li', attr__class: 'ph-sensitive', attr__title: 'Alice Smith' },
                    { tag_name: 'main', attr__class: 'page', attr__title: 'Home' },
                ],
                $external_click_url: 'https://alice.example.com',
            },
        } as unknown as CaptureResult
        redactAutocapture(event, page)
        expect(event.properties).toEqual({
            $elements_chain:
                'span:nth-child="1"nth-of-type="1";a.row:attr__class="row"nth-child="3"nth-of-type="3";li.ph-sensitive:attr__class="ph-sensitive"nth-child="1"nth-of-type="1";main.page:attr__class="page"attr__aria-label="Wallet ****************"nth-child="1"nth-of-type="1"',
            $elements: [
                { tag_name: 'a', classes: ['row'] },
                { tag_name: 'li', attr__class: 'ph-sensitive' },
                { tag_name: 'main', attr__class: 'page', attr__title: 'Home' },
            ],
        })
    })

    it('leaves other events alone', () => {
        const event = {
            event: '$pageview',
            properties: { $external_click_url: 'https://x.example/a?b=c', $el_text: 'Card 4111 1111 1111 1111' },
        } as unknown as CaptureResult
        expect(redactAutocapture(event, page)).toEqual({
            event: '$pageview',
            properties: { $external_click_url: 'https://x.example/a?b=c', $el_text: 'Card 4111 1111 1111 1111' },
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
                    const redacted = redactAutocapture(event, window.location.href)
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
            <main aria-label="Wallet of alice@example.com">
                <button id="max" aria-label="Use your balance: 1,234.56 USD">Use <span>1,234.56 USD</span></button>
                <button id="continue" class="btn">Continue</button>
                <a id="link" href="/home?ref=alice" title="Home of @alice">Home of @alice</a>
                <a id="doc" href="https://storage.example.com/uploads/receipt-alice.pdf?sig=s3cr3tSig" target="_blank">receipt</a>
                <ul class="ph-sensitive">
                    <li><button id="contact" class="row" aria-label="Pay Alice Smith" title="Alice Smith"><span>Alice Smith</span></button></li>
                </ul>
                <button id="secret" class="ph-no-capture">Reveal</button>
                <input id="field" value="9876" />
                <div id="plain">Just text</div>
            </main>`
    })
    const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const autocaptured = () => captured.filter((event) => event.event === '$autocapture')

    it('sends a button label with its words and long numbers masked', () => {
        click('max')
        expect(autocaptured()).toHaveLength(1)
        const { properties } = autocaptured()[0]
        expect(properties.$el_text).toBe('Use *,***.** USD')
        expect(properties.$elements_chain).toMatch(/^button/)
        expect(properties.$elements_chain).toContain('attr__aria-label="Use your balance: *,***.** USD"')
        expect(properties.$elements_chain).toContain('attr__aria-label="Wallet of [email]"')
        const sent = JSON.stringify(autocaptured()[0])
        expect(sent).not.toContain('1,234.56')
        expect(sent).not.toContain('alice@example.com')
    })

    it('keeps a plain label and the classes', () => {
        click('continue')
        expect(autocaptured()[0].properties.$el_text).toBe('Continue')
        expect(autocaptured()[0].properties.$elements_chain).toMatch(/^button\.btn:.*text="Continue"/)
    })

    it('keeps a link label with a @username and the link path', () => {
        click('link')
        expect(autocaptured()).toHaveLength(1)
        expect(autocaptured()[0].properties.$el_text).toBe('Home of @alice')
        expect(autocaptured()[0].properties.$elements_chain).toContain('attr__href="/home"')
        expect(JSON.stringify(autocaptured()[0])).not.toContain('ref=alice')
    })

    it('sends only the host of an external link, such as an uploaded attachment', () => {
        click('doc')
        expect(autocaptured()).toHaveLength(1)
        const sent = JSON.stringify(autocaptured()[0])
        expect(sent).toContain('https://storage.example.com')
        expect(sent).not.toContain('uploads')
        expect(sent).not.toContain('receipt-alice')
        expect(sent).not.toContain('s3cr3tSig')
    })

    it('sends a click inside a ph-sensitive element without its text or attributes', () => {
        click('contact')
        expect(autocaptured()).toHaveLength(1)
        const { properties } = autocaptured()[0]
        expect(properties.$el_text).toBeUndefined()
        expect(properties.$elements_chain).toMatch(/^button\.row:attr__class="row"nth-child="1"nth-of-type="1";li:/)
        expect(JSON.stringify(autocaptured()[0])).not.toContain('Alice')
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
