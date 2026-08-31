describe('normalizeEnsName', () => {
    const load = async () => (await import('../ens-name.utils')).normalizeEnsName

    beforeEach(() => {
        jest.resetModules()
        process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN = 'peanut.me'
    })

    it('strips the peanut domain and the root dot', async () => {
        const normalizeEnsName = await load()
        // resolvers return fully qualified names; the root dot must not defeat the match
        expect(normalizeEnsName('hugo0.peanut.me.')).toBe('hugo0')
        expect(normalizeEnsName('hugo0.peanut.me')).toBe('hugo0')
    })

    it('does not truncate a name that merely ends in the same letters', async () => {
        const normalizeEnsName = await load()
        expect(normalizeEnsName('notpeanut.me')).toBe('notpeanut.me')
        expect(normalizeEnsName('notpeanut.me.')).toBe('notpeanut.me')
    })

    it('passes other ENS names through without their root dot', async () => {
        const normalizeEnsName = await load()
        expect(normalizeEnsName('alice.eth.')).toBe('alice.eth')
        expect(normalizeEnsName('alice.eth')).toBe('alice.eth')
    })

    it('leaves the bare domain alone', async () => {
        const normalizeEnsName = await load()
        expect(normalizeEnsName('peanut.me.')).toBe('peanut.me')
    })

    it('returns null for empty input', async () => {
        const normalizeEnsName = await load()
        expect(normalizeEnsName('')).toBeNull()
        expect(normalizeEnsName(null)).toBeNull()
        expect(normalizeEnsName(undefined)).toBeNull()
    })

    it('passes everything through when no domain is configured', async () => {
        process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN = ''
        const normalizeEnsName = await load()
        expect(normalizeEnsName('hugo0.peanut.me.')).toBe('hugo0.peanut.me')
    })
})
