import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
    MAX_RAW_BADGE_CAMPAIGN_LENGTH,
    MAX_BADGE_CAMPAIGNS,
    LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE,
    LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE,
    badgeCampaignForLegacyWire,
    badgeCampaignsFromSearchParams,
    clearPendingBadgeCampaigns,
    getPendingBadgeCampaigns,
    parsePendingBadgeCampaigns,
    queuePendingBadgeCampaigns,
    savePendingBadgeCampaigns,
} from './badge-campaign-context'
import { getFromCookie } from '@/utils/general.utils'
import { removeFromCookie, saveToCookie } from '@/utils/general.utils'

function filesUnder(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? filesUnder(path) : [path]
    })
}

describe('badge campaign identity transport', () => {
    it('preserves repeated canonical badge campaign identities and their first-seen spelling', () => {
        const params = new URLSearchParams(
            'badge_campaign=%20nita%20&badge_campaign=NITA&badge_campaign=Creator%2FSummer'
        )

        expect(badgeCampaignsFromSearchParams(params)).toEqual(['nita', 'Creator/Summer'])
    })

    it('preserves published legacy campaign and campaignTag spellings', () => {
        const params = new URLSearchParams('campaignTag=NITA&campaign=nita&campaign=second')

        expect(badgeCampaignsFromSearchParams(params)).toEqual(['NITA', 'second'])
    })

    it('enforces the backend tag count and length bounds', () => {
        const params = new URLSearchParams()
        for (let index = 0; index < MAX_BADGE_CAMPAIGNS + 3; index += 1) {
            params.append('badge_campaign', `tag-${index}`)
        }
        params.append('badge_campaign', 'x'.repeat(MAX_RAW_BADGE_CAMPAIGN_LENGTH + 1))

        const badgeCampaigns = badgeCampaignsFromSearchParams(params)
        expect(badgeCampaigns).toHaveLength(MAX_BADGE_CAMPAIGNS)
        expect(badgeCampaigns).toEqual(Array.from({ length: MAX_BADGE_CAMPAIGNS }, (_, index) => `tag-${index}`))
    })

    it('drops an overlong identity even when the count limit is not reached', () => {
        const params = new URLSearchParams()
        params.append('badge_campaign', 'x'.repeat(MAX_RAW_BADGE_CAMPAIGN_LENGTH + 1))
        params.append('badge_campaign', ' valid ')

        expect(badgeCampaignsFromSearchParams(params)).toEqual(['valid'])
    })

    it('gives canonical badge campaigns precedence over legacy and analytics parameters', () => {
        const params = new URLSearchParams(
            'utm_campaign=summer-analytics&campaign=legacy&campaignTag=older&badge_campaign=nita&badge_campaign=second'
        )

        expect(badgeCampaignsFromSearchParams(params)).toEqual(['nita', 'second'])
    })

    it.each([
        `badge_campaign=&campaign=legacy&utm_campaign=offramp`,
        `badge_campaign=${'x'.repeat(MAX_RAW_BADGE_CAMPAIGN_LENGTH + 1)}&campaign=legacy&utm_campaign=offramp`,
    ])('does not let a lower-priority transport override a rejected canonical campaign: %s', (query) => {
        expect(badgeCampaignsFromSearchParams(new URLSearchParams(query))).toEqual([])
    })

    it('gives published legacy explicit parameters precedence over UTM analytics', () => {
        const params = new URLSearchParams('utm_campaign=offramp&campaignTag=legacy-tag&campaign=second')

        expect(badgeCampaignsFromSearchParams(params)).toEqual(['legacy-tag', 'second'])
    })

    it.each([
        `campaign=&utm_campaign=offramp`,
        `campaignTag=${'x'.repeat(MAX_RAW_BADGE_CAMPAIGN_LENGTH + 1)}&utm_campaign=offramp`,
    ])('does not let UTM override a rejected legacy campaign: %s', (query) => {
        expect(badgeCampaignsFromSearchParams(new URLSearchParams(query))).toEqual([])
    })

    it('never turns a UTM value into a badge identity (TASK-21226)', () => {
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('utm_campaign=Summer-Analytics'))).toEqual([])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('badge_campaign=arbitrum'))).toEqual(['arbitrum'])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('utm_campaign=arbitrum'))).toEqual([])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('badge_campaign=offramp'))).toEqual(['offramp'])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('utm_campaign=offramp'))).toEqual([])
        // an explicitly published utm: identity stays a valid canonical value
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('badge_campaign=utm:offramp'))).toEqual([
            'utm:offramp',
        ])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('badge_campaign=IRL_NOMADS'))).toEqual(['IRL_NOMADS'])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('badge_campaign=irl_nomads'))).toEqual(['irl_nomads'])
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('utm_campaign=irl-nomads'))).toEqual([])
    })

    it('ignores every published content UTM as a badge identity', () => {
        const publishedValues = new Set<string>()
        for (const file of filesUnder(join(process.cwd(), 'src/content'))) {
            const source = readFileSync(file, 'utf8')
            for (const match of source.matchAll(/utm_campaign=([^&"'\s<>)]*)/g)) {
                if (match[1]) publishedValues.add(match[1])
            }
        }

        // Guard the corpus scan itself with the known collision that motivated
        // source qualification, then confirm no published UTM value can mint a
        // badge identity now that the last alias retired (TASK-21226).
        expect(publishedValues.has('arbitrum')).toBe(true)
        expect(publishedValues.size).toBeGreaterThan(0)
        for (const rawValue of publishedValues) {
            expect(badgeCampaignsFromSearchParams(new URLSearchParams({ utm_campaign: rawValue }))).toEqual([])
        }
    })

    it('never infers a campaign from code-only creator attribution', () => {
        expect(badgeCampaignsFromSearchParams(new URLSearchParams('code=juanacervio'))).toEqual([])
    })

    it('keeps inviter attribution and campaign acquisition independent', () => {
        const params = new URLSearchParams('code=juanacervio&utm_campaign=summer-analytics&badge_campaign=nita')

        expect(params.get('code')).toBe('juanacervio')
        expect(params.get('utm_campaign')).toBe('summer-analytics')
        expect(badgeCampaignsFromSearchParams(params)).toEqual(['nita'])
    })

    it('adapts canonical-first URL intent to published singular campaignTag wires', () => {
        expect(
            badgeCampaignForLegacyWire(
                new URLSearchParams(
                    'utm_campaign=analytics&campaign=legacy&badge_campaign=canonical-first&badge_campaign=canonical-second'
                )
            )
        ).toBe('canonical-first')
        expect(badgeCampaignForLegacyWire(new URLSearchParams('campaignTag=published-legacy'))).toBe('published-legacy')
        // utm values stopped being badge identities (TASK-21226)
        expect(badgeCampaignForLegacyWire(new URLSearchParams('utm_campaign=historic-alias'))).toBeUndefined()
        expect(badgeCampaignForLegacyWire(new URLSearchParams('code=creator'))).toBeUndefined()
    })

    it('round-trips array cookies losslessly and reads a legacy scalar cookie', () => {
        expect(parsePendingBadgeCampaigns(['Creator/Summer', 'Tag,With,Commas'])).toEqual([
            'Creator/Summer',
            'Tag,With,Commas',
        ])
        expect(parsePendingBadgeCampaigns('legacy-tag')).toEqual(['legacy-tag'])
    })

    it('keeps the legacy key scalar while v2 stores the lossless queue', () => {
        savePendingBadgeCampaigns(['single'])
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)).toBe('single')
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)).toEqual(['single'])
        expect(getPendingBadgeCampaigns()).toEqual(['single'])

        savePendingBadgeCampaigns(['first', 'second'])
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)).toBe('second')
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)).toEqual(['first', 'second'])
        expect(getPendingBadgeCampaigns()).toEqual(['first', 'second'])
        clearPendingBadgeCampaigns()
    })

    it('migrates the previous array-shaped legacy cookie into v2 and scalarizes the old key', () => {
        saveToCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE, ['legacy-first', 'legacy-newest'])

        expect(getPendingBadgeCampaigns()).toEqual(['legacy-first', 'legacy-newest'])
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)).toEqual(['legacy-first', 'legacy-newest'])
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)).toBe('legacy-newest')

        clearPendingBadgeCampaigns()
    })

    it('merges a newer old-bundle scalar without letting old clearing erase v2', () => {
        savePendingBadgeCampaigns(['v2-first', 'v2-second'])

        // An older open bundle knows only campaignTag and writes a new intent.
        saveToCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE, 'old-bundle-newest')
        expect(getPendingBadgeCampaigns()).toEqual(['v2-first', 'v2-second', 'old-bundle-newest'])
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)).toEqual([
            'v2-first',
            'v2-second',
            'old-bundle-newest',
        ])

        // Its terminal cleanup removes only the scalar it understands.
        removeFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)
        expect(getPendingBadgeCampaigns()).toEqual(['v2-first', 'v2-second', 'old-bundle-newest'])

        clearPendingBadgeCampaigns()
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)).toBeNull()
        expect(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)).toBeNull()
    })

    it('keeps a newly clicked campaign when a full retry queue must evict an old entry', () => {
        const oldCampaigns = Array.from({ length: MAX_BADGE_CAMPAIGNS }, (_, index) => `old-${index}`)
        savePendingBadgeCampaigns(oldCampaigns)

        expect(queuePendingBadgeCampaigns(['new-live-campaign'])).toEqual([
            ...oldCampaigns.slice(1),
            'new-live-campaign',
        ])
        expect(getPendingBadgeCampaigns()).toEqual([...oldCampaigns.slice(1), 'new-live-campaign'])

        clearPendingBadgeCampaigns()
    })

    it('clears bearer acquisition intent before an explicit account switch', () => {
        savePendingBadgeCampaigns(['first-account-retry'], 30)
        expect(getPendingBadgeCampaigns()).toEqual(['first-account-retry'])

        clearPendingBadgeCampaigns()

        expect(getPendingBadgeCampaigns()).toEqual([])
    })

    it('treats a lost campaign query as no acquisition intent, never as attribution', () => {
        const before = badgeCampaignsFromSearchParams(new URLSearchParams('code=juanacervio&badge_campaign=nita'))
        const after = badgeCampaignsFromSearchParams(new URLSearchParams('code=juanacervio'))

        expect(before).toEqual(['nita'])
        expect(after).toEqual([])
    })
})
