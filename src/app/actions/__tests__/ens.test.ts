import { resolveEns } from '@/app/actions/ens'

const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}))

const jsonResponse = (status: number, body: unknown) =>
    ({ status, json: () => Promise.resolve(body) }) as unknown as Response

// Synthetic fixtures — no customer data.
const PIX_MERCHANT_PAYLOAD =
    '00020126580014br.gov.bcb.pix0136synthetic-key-0000-0000-0000000000005204000053039865802BR6304ABCD'
const TYPED_SENTENCE = `${'quiero enviar plata a mi hermano que vive en cordoba '.repeat(5)}.`

describe('resolveEns', () => {
    beforeEach(() => {
        mockServerFetch.mockReset()
    })

    it.each([
        ['an Argentine payment alias', 'CASA.FUTBOLERA'],
        ['a typed sentence', TYPED_SENTENCE],
        ['a pasted PIX merchant payload', PIX_MERCHANT_PAYLOAD],
        ['a name with an overlong label', `${'a'.repeat(64)}.eth`],
        ['a malformed name', 'test..eth'],
        ['a bare label', 'kusharc'],
        ['a non-breaking space', 'foo bar.eth'],
        ['an IDN name with an embedded space', 'münchen bücher.de'],
        ['a URL with a path', 'example.com/path'],
    ])('does not call the API for %s', async (_description, input) => {
        await expect(resolveEns(input)).resolves.toBeUndefined()
        expect(mockServerFetch).not.toHaveBeenCalled()
    })

    it('resolves a .eth name', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse(200, { address: '0xabc' }))

        await expect(resolveEns('resolvable.eth')).resolves.toBe('0xabc')
        expect(mockServerFetch).toHaveBeenCalledWith('/ens/resolvable.eth', { method: 'GET' })
    })

    it('resolves a DNS-backed name', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse(200, { address: '0xdef' }))

        await expect(resolveEns('sub.dns-backed.xyz')).resolves.toBe('0xdef')
        expect(mockServerFetch).toHaveBeenCalledWith('/ens/sub.dns-backed.xyz', { method: 'GET' })
    })

    it('forwards the destination chainId (ENSIP-11)', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse(200, { address: '0x123' }))

        await resolveEns('chain-scoped.eth', '42161')

        expect(mockServerFetch).toHaveBeenCalledWith('/ens/chain-scoped.eth?chainId=42161', { method: 'GET' })
    })

    // The guard normalizes before it judges, so the transport has to send the
    // same form — otherwise the raw input still reaches the URL.
    it.each([
        ['an uppercase name', 'UPPER.ETH', '/ens/upper.eth'],
        ['a root dot', 'rootdot.eth.', '/ens/rootdot.eth'],
        ['surrounding whitespace', '  padded.eth  ', '/ens/padded.eth'],
        ['all three at once', '  MIXED.Eth.  ', '/ens/mixed.eth'],
        // Percent-encoded UTF-8 of the ENSIP-15 form, never the raw input.
        ['an IDN name', '  MÜNCHEN.DE.  ', `/ens/${encodeURIComponent('münchen.de')}`],
        ['an emoji name', '🚀.ETH', `/ens/${encodeURIComponent('🚀.eth')}`],
        // U+200B is ignored by ENSIP-15, so the name is real and the invisible
        // character never reaches the URL.
        ['an ignored zero-width space', 'foo​bar.eth', '/ens/foobar.eth'],
    ])('sends the normalized name for %s', async (_description, input, expectedPath) => {
        mockServerFetch.mockResolvedValue(jsonResponse(200, { address: '0xnorm' }))

        await expect(resolveEns(input)).resolves.toBe('0xnorm')
        expect(mockServerFetch).toHaveBeenCalledWith(expectedPath, { method: 'GET' })
    })

    it('sends the normalized name together with a chainId', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse(200, { address: '0xboth' }))

        await resolveEns('  BOTH.Eth.  ', '42161')

        expect(mockServerFetch).toHaveBeenCalledWith('/ens/both.eth?chainId=42161', { method: 'GET' })
    })

    it('does not call the API for a huge whitespace-padded name', async () => {
        const padded = `${' '.repeat(600)}vitalik.eth${' '.repeat(600)}`

        await expect(resolveEns(padded)).resolves.toBeUndefined()
        expect(mockServerFetch).not.toHaveBeenCalled()
    })

    it('returns undefined on a handled 404', async () => {
        mockServerFetch.mockResolvedValue(jsonResponse(404, {}))

        await expect(resolveEns('missing-record.eth')).resolves.toBeUndefined()
        expect(mockServerFetch).toHaveBeenCalled()
    })
})
