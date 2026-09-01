import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SIDEBAR_CONFIG } from '../_components/nav-config'

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
