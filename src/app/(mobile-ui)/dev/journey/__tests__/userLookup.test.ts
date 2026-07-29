import { inspectParam, isUuid } from '../userLookup'

describe('userLookup', () => {
    it('recognises a canonical uuid, in either case, with surrounding space', () => {
        expect(isUuid('3f7b1c2a-9d4e-4a11-8b6c-2e5f0a7d1c93')).toBe(true)
        expect(isUuid('3F7B1C2A-9D4E-4A11-8B6C-2E5F0A7D1C93')).toBe(true)
        expect(isUuid('  3f7b1c2a-9d4e-4a11-8b6c-2e5f0a7d1c93  ')).toBe(true)
    })

    it('rejects usernames and near-miss uuids', () => {
        expect(isUuid('hugo')).toBe(false)
        expect(isUuid('uuid-lover')).toBe(false)
        expect(isUuid('')).toBe(false)
        // one hex digit short in the last group
        expect(isUuid('3f7b1c2a-9d4e-4a11-8b6c-2e5f0a7d1c9')).toBe(false)
        // no hyphens
        expect(isUuid('3f7b1c2a9d4e4a118b6c2e5f0a7d1c93')).toBe(false)
    })

    it('routes each term to the right query param', () => {
        expect(inspectParam('3f7b1c2a-9d4e-4a11-8b6c-2e5f0a7d1c93')).toBe('userId')
        expect(inspectParam('hugo')).toBe('username')
    })
})
