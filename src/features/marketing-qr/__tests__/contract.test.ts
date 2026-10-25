import {
    MARKETING_QR_REGISTRATIONS,
    buildMarketingQrUrl,
    getMarketingQrRegistration,
    marketingQrContinuation,
    parseMarketingQrHandoff,
    parseMarketingQrQuery,
    validateMarketingQrCampaign,
} from '../contract'

const registration = getMarketingQrRegistration('home-hero-en')!
const context = { page: 'home' as const, placement: 'hero', locale: 'en' }
const campaign = { source: 'google', medium: 'cpc', campaign: 'accounts-launch', content: 'creative-a' }
const originalSwitch = process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
beforeEach(() => {
    process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = 'true'
})
afterAll(() => {
    if (originalSwitch === undefined) delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    else process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = originalSwitch
})

it('is disabled by default and never registers payment or account surfaces', () => {
    delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    expect(buildMarketingQrUrl({ origin: 'https://peanut.me', context })).toBeNull()
    expect(getMarketingQrRegistration('send-hero-en')).toBeNull()
    expect(getMarketingQrRegistration('peanut-card-hero-en')).toBeNull()
    expect(getMarketingQrRegistration('__proto__')).toBeNull()
    expect(getMarketingQrRegistration('qr-brazil-hero-sticker-pt-br')).toBeNull()
})

it('keeps every registered default within the QR URL budget and canonicalizes locale', () => {
    for (const item of MARKETING_QR_REGISTRATIONS) {
        expect(item.qr_id).toMatch(/^[a-z0-9-]{1,48}$/)
        expect(item.defaults.source).toBeDefined()
        expect(Buffer.byteLength(`https://peanut.me/q/${item.qr_id}`)).toBeLessThanOrEqual(200)
    }
    expect(buildMarketingQrUrl({ origin: 'https://peanut.me', context: { ...context, locale: 'es-AR' } })).toBe(
        'https://peanut.me/q/home-hero-es-ar'
    )
    expect(buildMarketingQrUrl({ origin: 'https://peanut.me', context: { ...context, locale: 'es' } })).toBe(
        'https://peanut.me/q/home-hero-es-419'
    )
})

it('preserves a complete current tuple without desktop identity, click IDs or referral state', () => {
    const searchParams = new URLSearchParams({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'accounts-launch',
        utm_content: 'creative-a',
        gclid: 'private-click',
        at: 'private-journey',
        code: 'private-inviter',
        badge_campaign: 'private-badge',
        wid: 'private-person',
    })
    const url = buildMarketingQrUrl({
        origin: 'https://peanut.me',
        context,
        searchParams,
        analyticsEnabled: true,
        savedCampaign: { source: 'twitter', medium: 'social', campaign: 'old-campaign' },
    })!
    const parsed = parseMarketingQrQuery(registration, new URL(url).searchParams)
    expect(parsed).toMatchObject({
        valid: true,
        campaign,
        attributionOrigin: 'current_url',
        attributionAdjustment: 'none',
    })
    expect(url).not.toMatch(/private|gclid|badge|wid|code=/)
})

it('uses a whole saved tuple or defaults, and does not recover campaign state after opt-out', () => {
    const input = {
        origin: 'https://peanut.me',
        context,
        searchParams: new URLSearchParams('utm_source=meta'),
        savedCampaign: campaign,
    }
    const saved = buildMarketingQrUrl({ ...input, analyticsEnabled: true })!
    expect(parseMarketingQrQuery(registration, new URL(saved).searchParams)).toMatchObject({
        campaign,
        attributionOrigin: 'saved_campaign',
    })
    expect(buildMarketingQrUrl({ ...input, analyticsEnabled: false })).toBe('https://peanut.me/q/home-hero-en')
})

it.each([
    'blog',
    'compare',
    'countries',
    'country-hub',
    'deposit-account',
    'deposit-from',
    'pay-with-method',
    'pricing',
    'receive-from-country',
    'send-to-country',
    'send-to-country-from',
    'stories',
    'supported-networks',
    'use-cases',
    'withdraw',
])('preserves the existing content source %s when a visitor later scans an LP QR', (source) => {
    const url = buildMarketingQrUrl({
        origin: 'https://peanut.me',
        context,
        analyticsEnabled: true,
        savedCampaign: { source, medium: 'content', campaign: 'wise', content: 'hero' },
    })!
    expect(parseMarketingQrQuery(registration, new URL(url).searchParams)).toMatchObject({
        valid: true,
        campaign: { source, medium: 'content', campaign: 'wise', content: 'hero' },
        attributionOrigin: 'saved_campaign',
    })
})

it.each(['&next=https://evil.test', '&wid=person', '&gclid=click', '&s=meta', '&a=bogus'])(
    'suppresses capture and cleans untrusted query %s',
    (suffix) => {
        const parsed = parseMarketingQrQuery(registration, new URLSearchParams(`s=google&m=cpc&c=launch${suffix}`))
        expect(parsed).toMatchObject({ valid: false, campaign: registration.defaults })
        const next = marketingQrContinuation(registration, parsed.campaign, parsed.valid)
        expect(next).toContain('qr_analytics=deny')
        expect(next).not.toContain('utm_')
    }
)

it.each([
    'user@example.com',
    'user%40example.com',
    'http://evil.test',
    'www.example.com',
    '1234567890',
    '+34 612 345 678',
    'a'.repeat(65),
    '00000000-0000-0000-0000-000000000000',
    'campaign-00000000-0000-7000-8000-000000000000',
    `0x${'a'.repeat(40)}`,
    `campaign-0x${'a'.repeat(40)}`,
    '127.0.0.1',
    'campaign\nlaunch',
])('rejects identifiers or malformed required campaign %s', (value) => {
    expect(validateMarketingQrCampaign({ ...campaign, campaign: value })).toBeNull()
})

it('drops invalid optional content without merging campaign tuples', () => {
    expect(validateMarketingQrCampaign({ ...campaign, content: 'user@example.com' })).toEqual({
        source: 'google',
        medium: 'cpc',
        campaign: 'accounts-launch',
    })
    expect(parseMarketingQrQuery(registration, new URLSearchParams('s=google&o=saved_campaign'))).toMatchObject({
        campaign: registration.defaults,
        attributionOrigin: 'placement_default',
        valid: true,
    })
})

it('trims content first, then falls back to defaults when an inherited tuple cannot fit', () => {
    const searchParams = new URLSearchParams({
        utm_source: 'instagram',
        utm_medium: 'ambassador',
        utm_campaign: 'launch-' + 'z'.repeat(57),
        utm_content: 'n'.repeat(64),
    })
    const trimmed = buildMarketingQrUrl({ origin: 'https://peanut.me', context, searchParams, analyticsEnabled: true })!
    expect(trimmed.length).toBeLessThanOrEqual(200)
    expect(new URL(trimmed).searchParams.get('a')).toBe('content_trimmed')
    expect(new URL(trimmed).searchParams.has('n')).toBe(false)
    const fallback = buildMarketingQrUrl({
        origin: `https://${'x'.repeat(50)}.${'y'.repeat(50)}.test`,
        context,
        searchParams,
        analyticsEnabled: true,
    })!
    expect(fallback.length).toBeLessThanOrEqual(200)
    expect(parseMarketingQrQuery(registration, new URL(fallback).searchParams)).toMatchObject({
        campaign: registration.defaults,
        attributionOrigin: 'placement_default',
        attributionAdjustment: 'length_fallback',
    })
})

it('preserves existing inline QR campaign defaults', () => {
    expect(getMarketingQrRegistration('qr-argentina-close-sticker-en')?.defaults).toEqual({
        source: 'star-lp',
        medium: 'content',
        campaign: 'qr-ar',
        content: 'c',
    })
    expect(getMarketingQrRegistration('qr-brazil-ways-in-en')?.defaults).toEqual({
        source: 'star-lp',
        medium: 'content',
        campaign: 'qr-br',
        content: 'w',
    })
})

it('gates app parsing by registration, complete labels, duplicate fields and the deny marker', () => {
    const valid = new URL(marketingQrContinuation(registration, campaign, true), 'https://peanut.me').searchParams
    expect(parseMarketingQrHandoff(valid)).toMatchObject({ registration, campaign, analyticsAllowed: true })
    valid.set('qr_analytics', 'deny')
    expect(parseMarketingQrHandoff(valid)?.analyticsAllowed).toBe(false)
    valid.set('qr_analytics', 'allow')
    valid.append('utm_source', 'meta')
    expect(parseMarketingQrHandoff(valid)?.analyticsAllowed).toBe(false)
    expect(parseMarketingQrHandoff(new URLSearchParams('marketing_qr=send-person'))).toBeNull()
    const droppedContent = new URL(marketingQrContinuation(registration, campaign, true), 'https://peanut.me')
        .searchParams
    droppedContent.set('utm_content', 'user@example.com')
    expect(parseMarketingQrHandoff(droppedContent)?.analyticsAllowed).toBe(false)
})
