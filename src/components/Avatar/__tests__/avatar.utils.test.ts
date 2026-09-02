import { existsSync } from 'fs'
import { join } from 'path'
import badgeAssets from '@/types/badge-assets.json'
import { avatarPaletteClass, avatarPool, avatarSrc, badgeAvatarKeys, basicAvatarKeys } from '../avatar.utils'

describe('avatar catalog', () => {
    // the manifest is the API's contract: every slug it names must be real art
    // here, or the picker shows a broken image the day the API ships the badge
    it('resolves every avatar the manifest declares to a file under public/avatars', () => {
        const paths = [
            ...badgeAssets.avatars.basics.map((slug) => `/avatars/basic/${slug}.svg`),
            ...Object.entries(badgeAssets.avatars.badges).flatMap(([code, slugs]) =>
                slugs.map((slug) => `/avatars/badge/${code}/${slug}.svg`)
            ),
        ]
        expect(paths.length).toBeGreaterThanOrEqual(26)
        for (const path of paths) {
            expect({ path, exists: existsSync(join(process.cwd(), 'public', path)) }).toEqual({ path, exists: true })
        }
    })

    it('gives everyone the twenty basics and nothing from badges they do not hold', () => {
        expect(basicAvatarKeys()).toHaveLength(20)
        expect(basicAvatarKeys()[0]).toBe('basic.apple')
        expect(badgeAvatarKeys([])).toEqual([])
        expect(badgeAvatarKeys(['FIRST_INVITE', 'NOT_A_BADGE'])).toEqual([])
        expect(badgeAvatarKeys(['BUG_WHISPERER'])).toEqual([
            'badge.BUG_WHISPERER.beetle',
            'badge.BUG_WHISPERER.shell',
            'badge.BUG_WHISPERER.peek',
        ])
        expect(avatarPool(['OFFRAMP_USER'])).toHaveLength(23)
    })

    it('maps keys to their art and rejects anything the manifest does not know', () => {
        expect(avatarSrc('basic.apple')).toBe('/avatars/basic/apple.svg')
        expect(avatarSrc('badge.OFFRAMP_USER.wink')).toBe('/avatars/badge/OFFRAMP_USER/wink.svg')
        expect(avatarSrc('basic.peanut')).toBeNull()
        expect(avatarSrc('badge.BUG_WHISPERER.nope')).toBeNull()
        expect(avatarSrc('badge.FIRST_INVITE.beetle')).toBeNull()
        expect(avatarSrc('../etc/passwd')).toBeNull()
        expect(avatarSrc(null)).toBeNull()
        expect(avatarSrc(undefined)).toBeNull()
    })

    it('keeps a stable palette per key, from the seven avatar triples', () => {
        expect(avatarPaletteClass('basic.apple')).toBe(avatarPaletteClass('basic.apple'))
        expect(avatarPaletteClass('basic.apple')).toMatch(
            /^bg-avatar-(pink|yellow|purple|blue|red|orange|green) border-avatar-\1-border$/
        )
    })
})
