import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SIDEBAR_CONFIG, TIERS, filterNav } from '../_components/nav-config'

// F-21: the sidebar (and the tier index pages derived from it) must mirror the
// filesystem. two hand lists of one directory always drift — this pins the one
// remaining hand list (labels/icons/descriptions) to the actual page dirs.
const DS_ROOT = join(__dirname, '..')

const pageDirs = (tier: string) =>
    readdirSync(join(DS_ROOT, tier), { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
        .filter((e) => {
            try {
                readdirSync(join(DS_ROOT, tier, e.name)).includes('page.tsx')
                return readdirSync(join(DS_ROOT, tier, e.name)).includes('page.tsx')
            } catch {
                return false
            }
        })
        .map((e) => `/dev/ds/${tier}/${e.name}`)
        .sort()

describe.each(['foundations', 'primitives', 'patterns'] as const)('%s nav-config vs filesystem', (tier) => {
    it('lists every page dir exactly once', () => {
        const fs = pageDirs(tier)
        const config = SIDEBAR_CONFIG[tier].map((i) => i.href).sort()
        expect(config).toEqual(fs)
    })
})

// icons carry meaning here: a repeated one in a group means at least one entry
// is wearing an icon that belongs to something else
describe('nav icons', () => {
    it.each(Object.keys(SIDEBAR_CONFIG))('%s gives every entry its own icon', (tier) => {
        const icons = SIDEBAR_CONFIG[tier].map((item) => item.icon)
        expect(new Set(icons).size).toBe(icons.length)
    })

    it('gives every tier its own icon', () => {
        const icons = TIERS.map((tier) => tier.icon)
        expect(new Set(icons).size).toBe(icons.length)
    })

    it('points every tier at a config group', () => {
        TIERS.forEach((tier) => expect(SIDEBAR_CONFIG[tier.key]).toBeDefined())
    })
})

describe('filterNav', () => {
    it('returns the whole nav for an empty query', () => {
        const groups = filterNav('')
        expect(groups.map((g) => g.tier.key)).toEqual(TIERS.map((t) => t.key))
        expect(groups.flatMap((g) => g.items)).toHaveLength(
            Object.values(SIDEBAR_CONFIG).reduce((total, items) => total + items.length, 0)
        )
    })

    it('matches a label regardless of case', () => {
        const items = filterNav('cHeCkBoX').flatMap((g) => g.items)
        expect(items.map((i) => i.href)).toEqual(['/dev/ds/primitives/checkbox'])
    })

    it('matches a description, not only the label', () => {
        const items = filterNav('radix').flatMap((g) => g.items)
        expect(items.map((i) => i.href)).toContain('/dev/ds/primitives/base-select')
        expect(items.every((i) => !i.label.toLowerCase().includes('radix'))).toBe(true)
    })

    it('searches across tiers', () => {
        const groups = filterNav('card')
        expect(groups.map((g) => g.tier.key)).toEqual(['primitives', 'patterns'])
    })

    it('returns nothing when nothing matches', () => {
        expect(filterNav('zzzznotathing')).toEqual([])
    })
})
