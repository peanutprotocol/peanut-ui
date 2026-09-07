import { avatarGridColumns, avatarSrc, badgeAvatarKeys, dealAvatars } from '../avatar.utils'
it('deals only unique eligible art, even with duplicate badges or letters in input', () => {
    const unlocked = badgeAvatarKeys(['BUG_WHISPERER', 'BUG_WHISPERER'])
    for (let seed = 1; seed <= 30; seed++) {
        let state = seed
        const random = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
        const hand = dealAvatars([...unlocked, 'letter.a', 'unknown'], 16, random)
        expect(hand).toHaveLength(16)
        expect(new Set(hand.map(avatarSrc)).size).toBe(16)
        expect(hand.some((key) => unlocked.includes(key))).toBe(true)
        expect(hand.some((key) => key.startsWith('letter.'))).toBe(false)
    }
})
it('fits square grids to viewport and eligible pool', () => {
    expect(avatarGridColumns(320, 568, 40)).toBe(3)
    expect(avatarGridColumns(393, 852, 40)).toBe(4)
    expect(avatarGridColumns(430, 932, 40)).toBe(4)
    expect(avatarGridColumns(1440, 1080, 20)).toBe(4)
    expect(dealAvatars([], 25)).toHaveLength(20)
})
