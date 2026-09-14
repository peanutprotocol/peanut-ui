import { existsSync } from 'fs'
import { join } from 'path'
import badgeAssets from '@/types/badge-assets.json'
import en from '@/i18n/app/messages/en.json'
import { avatarPool, avatarSrc, badgeAvatarKeys, basicAvatarKeys, dealHand, letterAvatarSrc } from '../avatar.utils'

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
        // 26 letters + 20 basics + the 3 OFFRAMP_USER avatars
        expect(avatarPool(['OFFRAMP_USER'])).toHaveLength(49)
    })

    it('maps keys to their art and rejects anything the manifest does not know', () => {
        expect(avatarSrc('basic.apple')).toBe('/avatars/basic/apple.webp')
        expect(avatarSrc('badge.OFFRAMP_USER.wink')).toBe('/avatars/badge/OFFRAMP_USER/wink.webp')
        expect(avatarSrc('basic.peanut')).toBeNull()
        expect(avatarSrc('badge.BUG_WHISPERER.nope')).toBeNull()
        expect(avatarSrc('badge.FIRST_INVITE.beetle')).toBeNull()
        expect(avatarSrc('letter.k')).toBe('/avatars/letter/k.webp')
        expect(avatarSrc('letter.K')).toBeNull()
        expect(avatarSrc('letter.ab')).toBeNull()
        expect(avatarSrc('../etc/passwd')).toBeNull()
        // plain JSON object: prototype names must not read as badges
        expect(avatarSrc('badge.constructor.x')).toBeNull()
        expect(badgeAvatarKeys(['constructor', 'toString', '__proto__'])).toEqual([])
        expect(avatarSrc(null)).toBeNull()
        expect(avatarSrc(undefined)).toBeNull()
    })

    // every basic tile prints a name and a line, so a slug the API adds before
    // the copy lands would show as a bare capitalised slug with no line
    it('names and lines every basic in the cast catalog', () => {
        const cast: Record<string, { name: string; line: string }> = en.avatar.cast
        for (const slug of badgeAssets.avatars.basics) {
            expect({ slug, named: !!cast[slug]?.name, lined: !!cast[slug]?.line }).toEqual({
                slug,
                named: true,
                lined: true,
            })
        }
    })
})

describe('dealHand', () => {
    const seeded = (seed: number) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    const unlocked = badgeAvatarKeys(['BUG_WHISPERER'])
    const isBadge = (key: string | null) => !!key?.startsWith('badge.')

    it('deals the initial first, then seven distinct keys from the pool', () => {
        const hand = dealHand(null, unlocked, { random: seeded(1) })
        expect(hand).toHaveLength(8)
        expect(hand[0]).toBeNull()
        expect(new Set(hand).size).toBe(8)
        for (const key of hand.slice(1)) expect(avatarPool(['BUG_WHISPERER'])).toContain(key)
    })

    it('keeps the pick in the hand and always deals at least one earned avatar', () => {
        for (const pick of ['basic.sun', 'badge.BUG_WHISPERER.beetle']) {
            const hand = dealHand(pick, unlocked, { random: seeded(2) })
            expect(hand).toContain(pick)
            // a worn badge avatar does not count: the guarantee is a second earned card
            expect(hand.filter((key) => isBadge(key) && key !== pick).length).toBeGreaterThan(0)
        }
    })

    it('does not deal a pick this manifest does not know', () => {
        const hand = dealHand('basic.peanut', unlocked, { random: seeded(7) })
        expect(hand).toHaveLength(8)
        expect(hand).not.toContain('basic.peanut')
    })

    // slot 1 draws the initial itself, so a letter in slots 2-8 would be the
    // same sticker twice, with both tiles checked
    it('does not deal a letter pick', () => {
        const hand = dealHand('letter.k', unlocked, { random: seeded(8) })
        expect(hand).toHaveLength(8)
        expect(hand).not.toContain('letter.k')
        expect(hand.map(avatarSrc)).not.toContain('/avatars/letter/k.webp')
    })

    it('deals only basics to a user with no badges', () => {
        const hand = dealHand(null, [], { random: seeded(3) })
        expect(hand).toHaveLength(8)
        expect(hand.slice(1).every((key) => key?.startsWith('basic.'))).toBe(true)
    })

    it('prefers the named badge for the guaranteed card and falls back to any earned one', () => {
        const both = badgeAvatarKeys(['BUG_WHISPERER', 'OG_2025_10_12'])
        for (let seed = 1; seed <= 20; seed++) {
            const hand = dealHand(null, both, { prefer: 'OG_2025_10_12', random: seeded(seed) })
            expect(hand.some((key) => key?.startsWith('badge.OG_2025_10_12.'))).toBe(true)
        }
        // a badge with no art, or one the user does not hold, changes nothing
        expect(dealHand(null, unlocked, { prefer: 'FIRST_INVITE', random: seeded(4) }).some(isBadge)).toBe(true)
    })

    // the same badge code twice unlocks the same files twice: one drawing, one tile
    it('never deals two tiles that draw the same art', () => {
        const twice = badgeAvatarKeys(['BUG_WHISPERER', 'BUG_WHISPERER'])
        expect(twice).toHaveLength(6)
        for (let seed = 1; seed <= 20; seed++) {
            const art = dealHand('basic.sun', twice, { random: seeded(seed) })
                .slice(1)
                .map(avatarSrc)
            expect(art).toHaveLength(7)
            expect(new Set(art).size).toBe(7)
            expect(art).not.toContain(null)
        }
    })

    it('is deterministic for a seed; the die deals a new hand and never touches the pick', () => {
        const hand = dealHand('basic.sun', unlocked, { random: seeded(5) })
        expect(dealHand('basic.sun', unlocked, { random: seeded(5) })).toEqual(hand)

        const rolled = dealHand('basic.sun', unlocked, { random: seeded(6) })
        expect(rolled).not.toEqual(hand)
        expect(rolled).toContain('basic.sun')
        expect(rolled[0]).toBeNull()
    })
})
