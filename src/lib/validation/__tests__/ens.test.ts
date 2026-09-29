import { hasEnsNamespace, isSupportedEnsName, normalizeEnsName } from '@/lib/validation/ens'

// Synthetic fixtures — no customer data.
const PIX_MERCHANT_PAYLOAD =
    '00020126580014br.gov.bcb.pix0136synthetic-key-0000-0000-0000000000005204000053039865802BR6304ABCD'
const TYPED_SENTENCE = `${'quiero enviar plata a mi hermano que vive en cordoba '.repeat(5)}.`

describe('isSupportedEnsName', () => {
    it.each([
        ['vitalik.eth', '.eth name'],
        ['sub.vitalik.eth', '.eth subname'],
        ['a.b.c.vitalik.eth', 'deep .eth subname'],
        ['123.eth', 'all-digit label'],
        ['my-name.eth', 'hyphen inside a label'],
        ['hugo0.peanut.me', 'Peanut subname'],
        ['example.com', 'DNS-backed name'],
        ['www.example.com', 'DNS-backed subname'],
        ['sub.example.xyz', 'DNS-backed name under a newer TLD'],
        // Private public suffixes. `psl.isValid` is false for these at their
        // own root, which is why the suffix is probed by last label.
        ['github.io', 'private public suffix at its root'],
        ['blogspot.com', 'private public suffix at its root'],
        ['user.github.io', 'name under a private public suffix'],
        ['myblog.blogspot.com', 'name under a private public suffix'],
        // ENSIP-15 names. These reached the resolver before this validator
        // existed and must keep doing so — an ASCII allowlist broke them.
        ['🚀.eth', 'emoji label'],
        ['🚀🚀.eth', 'multi-emoji label'],
        ['vitalik🚀.eth', 'mixed text and emoji label'],
        ['münchen.de', 'IDN DNS-backed name'],
        ['bücher.example.com', 'IDN subname'],
        ['日本.eth', 'non-Latin script label'],
        // ENSIP-15 sets CheckHyphens false, so an edge hyphen is a valid label.
        ['-foo.eth', 'leading hyphen'],
        ['foo-.eth', 'trailing hyphen'],
        // Underscore is allowed at the start of a label.
        ['_foo.eth', 'leading underscore'],
    ])('accepts %s (%s)', (name) => {
        expect(isSupportedEnsName(name)).toBe(true)
    })

    it('accepts a fully qualified name with the root dot', () => {
        expect(isSupportedEnsName('vitalik.eth.')).toBe(true)
    })

    it('is case insensitive', () => {
        expect(isSupportedEnsName('Vitalik.ETH')).toBe(true)
    })

    it.each([
        ['CASA.FUTBOLERA', 'Argentine alias under no public suffix'],
        ['casa.futbolera', 'lowercased Argentine alias'],
        ['vitalik', 'single label'],
        ['.eth', 'empty first label'],
        ['test..eth', 'empty middle label'],
        ['foo_bar.eth', 'underscore away from the label start'],
        ['ab--cd.eth', 'invalid label extension (-- at position 3-4)'],
        ['foo bar.eth', 'space'],
        ['com.mercadolibre', 'reversed-domain QR fragment'],
        ['ar.com.globalgetnet', 'QR fragment whose tail is not a suffix'],
        // Unicode that ENSIP-15 refuses — accepting all non-ASCII would have
        // let these through.
        ['foo bar.eth', 'non-breaking space'],
        ['́foo.eth', 'leading combining mark'],
        ['münchen bücher.de', 'IDN with an embedded space'],
        // ASCII punctuation and URL shapes.
        ['example.com/path', 'path segment'],
        ['https://example.com', 'scheme and slashes'],
        ['user@example.com', 'at sign'],
        ['a*b.eth', 'asterisk'],
    ])('rejects %s (%s)', (name) => {
        expect(isSupportedEnsName(name)).toBe(false)
    })

    it('rejects a label over 63 characters', () => {
        expect(isSupportedEnsName(`${'a'.repeat(64)}.eth`)).toBe(false)
        expect(isSupportedEnsName(`${'a'.repeat(63)}.eth`)).toBe(true)
    })

    it('rejects a huge whitespace-padded input before trimming saves it', () => {
        const padded = `${' '.repeat(600)}vitalik.eth${' '.repeat(600)}`
        expect(isSupportedEnsName(padded)).toBe(false)
        // The same name unpadded is fine — the cap is on input size, not on it.
        expect(isSupportedEnsName('  vitalik.eth  ')).toBe(true)
    })

    it('rejects a name over 255 characters', () => {
        // 6 labels of 42 chars + dots = 257 characters, each label legal.
        const overlong = Array(6).fill('a'.repeat(42)).join('.')
        expect(overlong.length).toBeGreaterThan(255)
        expect(isSupportedEnsName(overlong)).toBe(false)
    })

    it('rejects a typed sentence', () => {
        expect(TYPED_SENTENCE.length).toBeGreaterThan(250)
        expect(isSupportedEnsName(TYPED_SENTENCE)).toBe(false)
    })

    it('rejects a pasted PIX merchant payload', () => {
        expect(isSupportedEnsName(PIX_MERCHANT_PAYLOAD)).toBe(false)
    })
})

describe('hasEnsNamespace', () => {
    it('recognizes a real namespace even when the name is malformed', () => {
        // Separates "bad ENS name" from "payment alias" — they get different copy.
        expect(hasEnsNamespace('test..eth')).toBe(true)
        expect(isSupportedEnsName('test..eth')).toBe(false)
    })

    it('does not recognize an Argentine alias suffix', () => {
        expect(hasEnsNamespace('CASA.FUTBOLERA')).toBe(false)
    })

    it('recognizes a public suffix an alias may also end in', () => {
        // Documented ambiguity: `.mp` is a real ccTLD, so a Mercado Pago-style
        // alias ending in it is read as a resolvable name.
        expect(hasEnsNamespace('juan.perez.mp')).toBe(true)
    })
})

describe('normalizeEnsName', () => {
    it('trims, lowercases and drops the root dot', () => {
        expect(normalizeEnsName('  Vitalik.ETH.  ')).toBe('vitalik.eth')
    })

    it('applies ENSIP-15 case folding to an IDN name', () => {
        expect(normalizeEnsName('MÜNCHEN.DE')).toBe('münchen.de')
        expect(normalizeEnsName('münchen.de')).toBe('münchen.de')
    })

    it('keeps an emoji label and folds only the ASCII around it', () => {
        expect(normalizeEnsName('🚀.ETH')).toBe(`${normalizeEnsName('🚀.eth')}`)
        expect(normalizeEnsName('🚀.ETH')).toMatch(/\.eth$/)
    })

    it('drops characters ENSIP-15 ignores rather than rejecting the name', () => {
        // U+200B is in the ignored set, so this is a real name, not garbage.
        // What matters is that the value we validate is the value we send.
        expect(normalizeEnsName('foo​bar.eth')).toBe('foobar.eth')
    })

    it('is idempotent — the value sent can be re-validated unchanged', () => {
        for (const input of ['Vitalik.ETH.', 'MÜNCHEN.DE', '🚀.ETH', '日本.eth', '_foo.eth']) {
            const once = normalizeEnsName(input)
            expect(once).not.toBeNull()
            expect(normalizeEnsName(once!)).toBe(once)
        }
    })

    it('returns null for everything the app will not send', () => {
        expect(normalizeEnsName('CASA.FUTBOLERA')).toBeNull()
        expect(normalizeEnsName('foo bar.eth')).toBeNull()
        expect(normalizeEnsName(TYPED_SENTENCE)).toBeNull()
        expect(normalizeEnsName('')).toBeNull()
    })
})
