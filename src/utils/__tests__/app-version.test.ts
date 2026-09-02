import { formatBinaryVersion } from '@/utils/app-version'

/**
 * The About screen's version line is what a support conversation starts from.
 * Peanut's release scheme is `<major>.<build>.<ota>` (scripts/release-version.mjs),
 * so all three segments are load-bearing and the CI build number is appended
 * rather than substituted for any of them.
 */
describe('formatBinaryVersion', () => {
    it('appends the CI build to the release version, replacing nothing', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '34534' })).toBe('1.1.0.34534')
    })

    // Overwriting the third segment would name an OTA revision that never shipped.
    it('keeps the OTA counter intact', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.4', appBuild: '34534' })).toBe('1.1.4.34534')
        expect(formatBinaryVersion({ appVersion: '2.17.3', appBuild: '7' })).toBe('2.17.3.7')
    })

    // Android is `10000 + run_number`, iOS is the run number: the same release
    // legitimately shows a ~10000 gap, and the format must not hide or "fix" it.
    it('shows each platform its own build number verbatim', () => {
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '44534' })).toBe('1.1.0.44534')
        expect(formatBinaryVersion({ appVersion: '1.1.0', appBuild: '34534' })).toBe('1.1.0.34534')
    })

    // Never render `undefined` or a leading dot into the one number support asks for.
    it.each([
        ['', '99', '99'],
        ['1.1.0', '', '1.1.0'],
    ])('degrades cleanly when a component is missing (%s / %s)', (appVersion, appBuild, expected) => {
        expect(formatBinaryVersion({ appVersion, appBuild })).toBe(expected)
    })
})
