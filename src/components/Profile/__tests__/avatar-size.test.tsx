import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { personFrom } from '@/lib/person/person'
import { renderWithIntl } from '@/test-utils/intl'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '../avatar-size.consts'
import AvatarWithBadge from '../AvatarWithBadge'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))
jest.mock('@/components/Avatar/useAvatarArt', () => ({ useAvatarArt: () => ({}) }))

// TASK-24388: a person avatar is 32 px in lists, rows and cards, and 96 px on
// profiles and the payment details header. Nothing else.
const BOX: Record<AvatarSize, string[]> = {
    s: ['h-8', 'w-8'],
    xl: ['h-24', 'w-24'],
}

// the size a rendered slot occupies, whichever element (sticker, initials,
// flag, bubble) the branch drew: h-N w-N or size-N, read off the outer box
function boxOf(el: Element): string {
    const cls = el.className.toString()
    const size = cls.match(/(?:^|\s)size-(\d+)(?:\s|$)/)
    if (size) return `${Number(size[1]) * 4}`
    const h = cls.match(/(?:^|\s)h-(\d+)(?:\s|$)/)
    const w = cls.match(/(?:^|\s)w-(\d+)(?:\s|$)/)
    return h && w && h[1] === w[1] ? `${Number(h[1]) * 4}` : `none (${cls})`
}

// the element that carries the size: AvatarWithBadge wraps its circle in an
// unsized `relative` div
const sizedBox = (container: HTMLElement): Element => {
    const first = container.firstElementChild!
    return first.classList.contains('relative') ? first.firstElementChild! : first
}

describe('AvatarSize', () => {
    it('has exactly the two approved sizes, 32 and 96', () => {
        expect(Object.keys(AVATAR_SIZE_CLASSES).sort()).toEqual(['s', 'xl'])
        expect(AVATAR_SIZE_CLASSES.s.split(' ')).toEqual(expect.arrayContaining(BOX.s))
        expect(AVATAR_SIZE_CLASSES.xl.split(' ')).toEqual(expect.arrayContaining(BOX.xl))
    })

    it('rejects the retired sizes at compile time', () => {
        // @ts-expect-error 24 px (xs) is retired
        const xs: AvatarSize = 'xs'
        // @ts-expect-error 48 px (m) is retired
        const m: AvatarSize = 'm'
        // @ts-expect-error 64 px (l) is retired
        const l: AvatarSize = 'l'
        expect([xs, m, l]).toHaveLength(3)
    })

    it('draws the initials fallback at 32 by default and 96 at xl', () => {
        const small = render(<AvatarWithBadge name="Satoshi Nakamoto" />)
        expect(boxOf(sizedBox(small.container))).toBe('32')
        const large = render(<AvatarWithBadge name="Satoshi Nakamoto" size="xl" />)
        expect(boxOf(sizedBox(large.container))).toBe('96')
    })
})

// Every branch of the slot resolver must fill the slot it is given, or a row
// with a bank next to a row with a person would not line up.
describe('TransactionAvatarBadge fills its slot on every branch', () => {
    const satoshi = personFrom({ username: 'satoshi', avatarKey: 'basic.frog' })
    const branches: Array<[string, Omit<ComponentProps<typeof TransactionAvatarBadge>, 'size'>]> = [
        ['a person (their sticker)', { transactionType: 'send', userName: 'satoshi', initials: 'S', person: satoshi }],
        [
            'a named row with no person (initials)',
            { transactionType: 'send', userName: 'Send failed', initials: 'SF', isPeer: false },
        ],
        ['a bank row with a flag', { transactionType: 'bank_withdraw', countryCode: 'ar' }],
        ['a bank row without a flag (bank bubble)', { transactionType: 'bank_withdraw' }],
        ['a link row (state bubble)', { transactionType: 'send', isLinkTransaction: true, status: 'pending' }],
        ['a crypto row (concept bubble)', { transactionType: 'withdraw' }],
        ['an open request (request bubble)', { transactionType: 'request' }],
    ]

    test.each(branches)('%s', (_label, props) => {
        for (const [size, px] of [
            ['s', '32'],
            ['xl', '96'],
        ] as const) {
            const { container, unmount } = renderWithIntl(<TransactionAvatarBadge {...props} size={size} />)
            expect(boxOf(sizedBox(container))).toBe(px)
            unmount()
        }
    })

    it('defaults to the list size, 32', () => {
        const { container } = renderWithIntl(
            <TransactionAvatarBadge transactionType="send" userName="satoshi" initials="S" person={satoshi} />
        )
        expect(boxOf(sizedBox(container))).toBe('32')
    })
})
