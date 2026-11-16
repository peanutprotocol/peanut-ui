import { getStoreUpdatePrompt } from './store-update-prompt'

describe('getStoreUpdatePrompt acceptance contract', () => {
    const iosCutoff = { ios: '2.0' }
    const androidCutoff = { android: '100' }

    it.each([
        [null, iosCutoff],
        [{ platform: 'ios', installedVersion: '1.0', availableVersion: '3.0' }, undefined],
        [{ platform: 'ios', installedVersion: '1.0', availableVersion: '1.0' }, iosCutoff],
        [{ platform: 'ios', installedVersion: '3.0', availableVersion: '2.0' }, iosCutoff],
        [{ platform: 'ios', installedVersion: 'bad', availableVersion: '3.0' }, iosCutoff],
        [{ platform: 'ios', installedVersion: '1.0', availableVersion: 'bad' }, iosCutoff],
        [{ platform: 'android', installedVersion: 'bad', availableVersion: '2' }, androidCutoff],
        [{ platform: 'android', installedVersion: '1', availableVersion: 'bad' }, androidCutoff],
        [{ platform: 'unknown', installedVersion: '1', availableVersion: '2' }, androidCutoff],
    ])('returns null for no policy or no eligible valid newer offer: %p', (offer, cutoffs) => {
        expect(getStoreUpdatePrompt(offer as never, cutoffs as never)).toBeNull()
    })

    it('selects Tier 4 for newer offers when there is no critical threshold, installed equals cutoff, or only the other platform has a cutoff', () => {
        expect(
            getStoreUpdatePrompt({ platform: 'ios', installedVersion: '1.0', availableVersion: '3.0' }, {})?.tier
        ).toBe(4)
        expect(
            getStoreUpdatePrompt({ platform: 'ios', installedVersion: '2.0', availableVersion: '3.0' }, iosCutoff)?.tier
        ).toBe(4)
        expect(
            getStoreUpdatePrompt({ platform: 'android', installedVersion: '1', availableVersion: '2' }, iosCutoff)?.tier
        ).toBe(4)
    })

    it('selects Tier 1 exactly when installed < cutoff <= offered', () => {
        expect(
            getStoreUpdatePrompt({ platform: 'ios', installedVersion: '1.9', availableVersion: '2.0' }, iosCutoff)?.tier
        ).toBe(1)
        expect(
            getStoreUpdatePrompt(
                { platform: 'android', installedVersion: '99', availableVersion: '100' },
                androidCutoff
            )?.tier
        ).toBe(1)
    })

    it('selects Tier 4 for valid newer offers below the cutoff or when only the other platform has a cutoff', () => {
        expect(
            getStoreUpdatePrompt({ platform: 'ios', installedVersion: '1.0', availableVersion: '1.9' }, iosCutoff)?.tier
        ).toBe(4)
        expect(
            getStoreUpdatePrompt({ platform: 'ios', installedVersion: '1.0', availableVersion: '2.1' }, androidCutoff)
                ?.tier
        ).toBe(4)
    })

    it('returns a version key and keeps the Tier 1 key stable across later store offers at the same cutoff', () => {
        const first = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.0', availableVersion: '2.0' },
            iosCutoff
        )
        const later = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.0', availableVersion: '3.0' },
            iosCutoff
        )
        expect(first).not.toBeNull()
        expect(later).not.toBeNull()
        expect(first?.tier).toBe(1)
        expect(later?.tier).toBe(1)
        expect(typeof first?.version).toBe('string')
        expect(first?.version).toBe(later?.version)
    })

    it('changes the Tier 4 key when the store offer changes and includes platform in the key', () => {
        const ios1 = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.0', availableVersion: '1.1' },
            iosCutoff
        )
        const ios2 = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.0', availableVersion: '1.2' },
            iosCutoff
        )
        const android = getStoreUpdatePrompt(
            { platform: 'android', installedVersion: '1', availableVersion: '2' },
            iosCutoff
        )
        expect(ios1?.tier).toBe(4)
        expect(ios2?.tier).toBe(4)
        expect(android?.tier).toBe(4)
        expect(ios1?.version).not.toBe(ios2?.version)
        expect(ios1?.version).not.toBe(android?.version)
    })

    it('uses distinct mutually exclusive routes for critical and regular updates', () => {
        const critical = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.9', availableVersion: '2.0' },
            iosCutoff
        )
        const regular = getStoreUpdatePrompt(
            { platform: 'ios', installedVersion: '1.0', availableVersion: '1.9' },
            iosCutoff
        )
        expect(critical?.tier).toBe(1)
        expect(regular?.tier).toBe(4)
        expect(critical?.tier).not.toBe(regular?.tier)
    })
})
