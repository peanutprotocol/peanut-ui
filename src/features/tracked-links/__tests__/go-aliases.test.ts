import { UTM_MEDIUMS } from '@/utils/utm.utils'
import { bareGoVisit, goHandoffPath, isAcquisitionSlug, parseGoVisitParams } from '../contract'
import { creatorBadgeCampaign } from '../creator-badges'
import { goAlias, GO_ALIASES, withGoAlias } from '../go-aliases'

describe.each(Object.entries(GO_ALIASES))('alias %s', (slug, alias) => {
    it('uses the username syntax for the slug and the inviter', () => {
        expect(isAcquisitionSlug(slug)).toBe(true)
        expect(isAcquisitionSlug(alias.inviter)).toBe(true)
    })

    it('carries tags that survive the handoff unchanged', () => {
        expect(Object.values(UTM_MEDIUMS)).toContain(alias.medium)
        const handoff = new URLSearchParams(goHandoffPath(withGoAlias(bareGoVisit(alias.inviter), alias)).split('?')[1])
        expect(parseGoVisitParams(handoff)?.utm).toMatchObject({ medium: alias.medium, campaign: alias.campaign })
    })

    // The handoff names the inviter, so an inviter with a creator badge would award it to every scan.
    it('credits an inviter without a creator badge', () => {
        expect(creatorBadgeCampaign(alias.inviter)).toBeUndefined()
    })
})

it('reads no alias from the object prototype', () => {
    expect(goAlias('constructor')).toBeUndefined()
    expect(goAlias('palermo')).toEqual({ inviter: 'squirrel', medium: 'cpm', campaign: 'palermo' })
})

it('lets the alias tags win over the query', () => {
    const visit = { ...bareGoVisit('squirrel'), code: 2 }
    visit.utm = { source: 'x', medium: 'email', campaign: 'forged', content: 'y' }
    expect(withGoAlias(visit, GO_ALIASES.palermo)).toEqual({
        ...visit,
        utm: { source: 'x', medium: 'cpm', campaign: 'palermo', content: 'y' },
    })
})
