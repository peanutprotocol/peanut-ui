import { existsSync } from 'fs'
import { join } from 'path'
import badgeAssets from '@/types/badge-assets.json'
import {
    avatarPaletteClass,
    avatarPool,
    avatarSrc,
    badgeAvatarKeys,
    basicAvatarKeys,
    letterAvatarSrc,
    offerBasics,
} from '../avatar.utils'

describe('avatar catalog', () => {
    // the manifest is the API's contract: every slug it names must be real art
    // here, or the picker shows a broken image the day the API ships the badge
    it('resolves every avatar the manifest declares to a file under public/avatars', () => {
        const paths = [
            ...badgeAssets.avatars.basics.map((slug) => `/avatars/basic/${slug}.webp`),
            ...Object.entries(badgeAssets.avatars.badges).flatMap(([code, slugs]) =>
                slugs.map((slug) => `/avatars/badge/${code}/${slug}.webp`)
            ),
        ]
        expect(paths.length).toBeGreaterThanOrEqual(26)
        for (const path of paths) {
            expect({ path, exists: existsSync(join(process.cwd(), 'public', path)) }).toEqual({ path, exists: true })
        }
    })

    // the letter set is the day-0 fallback and has no manifest entry, so nothing
    // else checks it: one missing file is a broken image for every user whose
    // name starts with that letter
    it('has sticker art for every letter a-z under public/avatars/letter', () => {
        for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
            const path = letterAvatarSrc(`${letter}oe`)
            expect(path).toBe(`/avatars/letter/${letter}.webp`)
            expect({ path, exists: existsSync(join(process.cwd(), 'public', path!)) }).toEqual({ path, exists: true })
        }
        expect(letterAvatarSrc('  Satoshi ')).toBe('/avatars/letter/s.webp')
        // a name the letter set cannot draw falls through to the initial avatar
        expect(letterAvatarSrc('0xdead')).toBeNull()
        expect(letterAvatarSrc('中本')).toBeNull()
        expect(letterAvatarSrc('')).toBeNull()
        expect(letterAvatarSrc(undefined)).toBeNull()
    })

    it('gives everyone the twenty basics and nothing from badges they do not hold', () => {
        expect(basicAvatarKeys()).toHaveLength(20)
        expect(basicAvatarKeys()[0]).toBe('basic.apple')
        expect(badgeAvatarKeys([])).toEqual([])
        // a catalog badge without art is listed as [] in the manifest: nothing unlocked
        expect(badgeAvatarKeys(['FIRST_INVITE', 'NOT_A_BADGE'])).toEqual([])
        expect(badgeAvatarKeys(['BUG_WHISPERER'])).toEqual([
            'badge.BUG_WHISPERER.beetle',
            'badge.BUG_WHISPERER.shell',
            'badge.BUG_WHISPERER.peek',
        ])
        expect(avatarPool(['OFFRAMP_USER'])).toHaveLength(23)
    })

    it('maps keys to their art and rejects anything the manifest does not know', () => {
        expect(avatarSrc('basic.apple')).toBe('/avatars/basic/apple.webp')
        expect(avatarSrc('badge.OFFRAMP_USER.wink')).toBe('/avatars/badge/OFFRAMP_USER/wink.webp')
        expect(avatarSrc('basic.peanut')).toBeNull()
        expect(avatarSrc('badge.BUG_WHISPERER.nope')).toBeNull()
        expect(avatarSrc('badge.FIRST_INVITE.beetle')).toBeNull()
        expect(avatarSrc('../etc/passwd')).toBeNull()
        // plain JSON object: prototype names must not read as badges
        expect(avatarSrc('badge.constructor.x')).toBeNull()
        expect(badgeAvatarKeys(['constructor', 'toString', '__proto__'])).toEqual([])
        expect(avatarSrc(null)).toBeNull()
        expect(avatarSrc(undefined)).toBeNull()
    })

    it('offers one row of five basics that always holds the pick', () => {
        const seeded = (seed: number) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280
        const row = offerBasics('basic.sun', 5, seeded(1))
        expect(row).toHaveLength(5)
        expect(row).toContain('basic.sun')
        expect(new Set(row).size).toBe(5)
        for (const key of row) expect(basicAvatarKeys()).toContain(key)

        // the dice deals a different row and never touches the pick
        const rerolled = offerBasics('basic.sun', 5, seeded(2))
        expect(rerolled).not.toEqual(row)
        expect(rerolled).toContain('basic.sun')

        // a badge pick is not a basic: five random basics, nothing kept
        expect(offerBasics('badge.BUG_WHISPERER.beetle', 5, seeded(3))).toHaveLength(5)
        expect(offerBasics(null, 5, seeded(4))).toHaveLength(5)
    })

    it('keeps a stable palette per key, from the seven avatar triples', () => {
        expect(avatarPaletteClass('basic.apple')).toBe(avatarPaletteClass('basic.apple'))
        expect(avatarPaletteClass('basic.apple')).toMatch(
            /^bg-avatar-(pink|yellow|purple|blue|red|orange|green) border-avatar-\1-border$/
        )
    })
})
