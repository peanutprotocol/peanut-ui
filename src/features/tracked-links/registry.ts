import { getMarketingQrRegistration } from '@/features/marketing-qr/contract'
import { parseAcquisitionCampaign, parseResolvedAcquisitionLink, type ResolvedAcquisitionLink } from './contract'

type CampaignLink = Extract<ResolvedAcquisitionLink, { kind: 'campaign' }>
// Append revisions; never edit or remove a distributed revision. Retire by appending a retired revision.
// No campaign is registered until its owner approves its destination and complete attribution tuple.
export const CAMPAIGN_LINK_REVISIONS: readonly CampaignLink[] = []

export function validateCampaignRegistry(revisions: readonly CampaignLink[]): void {
    const identities = new Map<string, string>()
    const latest = new Map<string, number>()
    for (const link of revisions) {
        if (!parseResolvedAcquisitionLink(link) || link.slug.startsWith('qr-'))
            throw new Error('Invalid campaign registration')
        if (identities.has(link.slug) && identities.get(link.slug) !== link.linkId)
            throw new Error('Campaign identity changed')
        if ([...identities].some(([slug, id]) => id === link.linkId && slug !== link.slug))
            throw new Error('Duplicate campaign identity')
        if (link.revision !== (latest.get(link.slug) ?? 0) + 1)
            throw new Error('Campaign revisions must be consecutive')
        identities.set(link.slug, link.linkId)
        latest.set(link.slug, link.revision)
    }
}
validateCampaignRegistry(CAMPAIGN_LINK_REVISIONS)

export function resolveRegisteredAcquisitionLink(slug: string, revision?: number): ResolvedAcquisitionLink | null {
    const campaigns = CAMPAIGN_LINK_REVISIONS.filter((link) => link.slug === slug)
    if (campaigns.length)
        return (revision ? campaigns.find((link) => link.revision === revision) : campaigns.at(-1)) ?? null
    if (!slug.startsWith('qr-') || (revision !== undefined && revision !== 1)) return null
    const qr = getMarketingQrRegistration(slug.slice(3))
    if (!qr) return null
    const campaign = parseAcquisitionCampaign(qr.defaults)
    if (!campaign) return null
    return {
        schemaVersion: 1,
        linkId: `qr_${qr.qr_id}`,
        slug,
        revision: 1,
        kind: 'marketing_qr',
        status: 'active',
        policy: 'personless',
        destination: { key: 'app-entry', continuation: qr.continuation },
        campaign,
        qr: { id: qr.qr_id },
    }
}
