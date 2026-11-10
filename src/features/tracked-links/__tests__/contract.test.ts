import { acquisitionHandoffPath, parseResolvedAcquisitionLink, type ResolvedAcquisitionLink } from '../contract'
import { resolveRegisteredAcquisitionLink, validateCampaignRegistry } from '../registry'

const invite: ResolvedAcquisitionLink = {
    schemaVersion: 1,
    linkId: `invite_${'a'.repeat(64)}`,
    slug: 'jo',
    revision: 1,
    kind: 'invite',
    status: 'active',
    policy: 'journey',
    invite: { code: 'jo' },
    destination: { key: 'app-entry', continuation: '/home' },
}
const campaign: Extract<ResolvedAcquisitionLink, { kind: 'campaign' }> = {
    schemaVersion: 1,
    linkId: 'campaign_launch',
    slug: 'c-launch',
    revision: 1,
    kind: 'campaign',
    status: 'active',
    policy: 'journey',
    campaign: { source: 'twitter', medium: 'cpc', campaign: 'launch' },
    destination: { key: 'app-entry', continuation: '/home' },
}
it('allows actual historical usernames and separates passive invite transport', () => {
    expect(parseResolvedAcquisitionLink(invite)).toEqual(invite)
    const params = new URL(acquisitionHandoffPath(invite, true), 'https://peanut.me').searchParams
    expect(params.get('acq_invite')).toBe('jo')
    expect(params.has('invite')).toBe(false)
    expect(params.get('tl_seen')).toBe('1')
})
it.each([
    { ...invite, policy: 'personless' },
    { ...invite, slug: 'c-alice' },
    { ...invite, invite: { code: 'bob' } },
    { ...invite, userId: 'private' },
    { ...invite, destination: { key: 'public-page', continuation: 'https://evil.com' } },
    { ...campaign, slug: 'alice' },
    { ...campaign, destination: { key: 'public-page', continuation: '/pay/alice' } },
    { ...campaign, campaign: { ...campaign.campaign, medium: 'paid' } },
])('rejects invalid ownership, policy, destination or metadata: %j', (value) => {
    expect(parseResolvedAcquisitionLink(value)).toBeNull()
})
it('adapts the original QR registration without changing its personless policy', () => {
    const qr = resolveRegisteredAcquisitionLink('qr-home-hero-en')
    expect(qr).toMatchObject({ kind: 'marketing_qr', policy: 'personless', revision: 1, qr: { id: 'home-hero-en' } })
    expect(parseResolvedAcquisitionLink(qr)).toEqual(qr)
    expect(resolveRegisteredAcquisitionLink('qr-home-hero-en', 2)).toBeNull()
})
it('reserves each alias and identity through retirement and forbids mutable revision replacement', () => {
    expect(() => validateCampaignRegistry([campaign, { ...campaign, revision: 2, status: 'retired' }])).not.toThrow()
    expect(() => validateCampaignRegistry([campaign, campaign])).toThrow()
    expect(() => validateCampaignRegistry([campaign, { ...campaign, revision: 2, linkId: 'campaign_other' }])).toThrow()
    expect(() => validateCampaignRegistry([{ ...campaign, slug: 'qr-home-hero-en' }])).toThrow()
})
