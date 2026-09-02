import { formatBinaryVersion } from '@/utils/app-version'

/**
 * The About screen's version line is what a support conversation starts from,
 * so it has to name the build a user is actually running.
 */
describe('formatBinaryVersion', () => {
    it('puts the build number in the patch position', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.1', appBuild: '34534' })).toBe('1.1.34534')
    })

    it('ignores whatever patch digit the marketing version carries', () => {
        // the marketing version is stamped by hand and its patch digit can sit
        // still for months; the build is the release workflow's run number
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '412' })).toBe('1.1.412')
        expect(formatBinaryVersion({ appVersion: '1.1.99', appBuild: '412' })).toBe('1.1.412')
    })

    it('carries a multi-digit minor through untouched', () => {
        expect(formatBinaryVersion({ appVersion: '2.10.3', appBuild: '7' })).toBe('2.10.7')
    })

    // Never render `undefined` into the one number support asks for.
    it.each([
        ['1', '1 (99)'],
        ['', ' (99)'],
    ])('falls back to the old shape for a malformed version (%s)', (appVersion, expected) => {
        expect(formatBinaryVersion({ appVersion, appBuild: '99' })).toBe(expected)
    })
})
