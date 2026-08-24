const fs = require('fs')
const path = require('path')

const { toMarketingVersion, stampMarketingVersion } = require('../marketing-version')

const PBXPROJ = path.join(__dirname, '..', '..', 'ios/App/App.xcodeproj/project.pbxproj')

describe('toMarketingVersion', () => {
    it('passes a three-component version straight through', () => {
        expect(toMarketingVersion('1.0.48')).toBe('1.0.48')
    })

    it('pads a short version so the patch component is always the one that moves', () => {
        expect(toMarketingVersion('1.0')).toBe('1.0.0')
        expect(toMarketingVersion('2')).toBe('2.0.0')
    })

    it('drops a prerelease suffix, which App Store Connect rejects', () => {
        expect(toMarketingVersion('1.0.48-rc.1')).toBe('1.0.48')
    })

    it('truncates beyond three components', () => {
        expect(toMarketingVersion('1.2.3.4')).toBe('1.2.3')
    })

    it('refuses a version it cannot turn into digits rather than emitting a wrong one', () => {
        expect(() => toMarketingVersion('')).toThrow()
        expect(() => toMarketingVersion('banana')).toThrow()
        expect(() => toMarketingVersion(undefined)).toThrow()
    })
})

describe('stampMarketingVersion', () => {
    it('rewrites every build configuration, not just the first', () => {
        const source = `
            MARKETING_VERSION = 1.0;
            SOMETHING_ELSE = keep;
            MARKETING_VERSION = 1.0;
        `

        const stamped = stampMarketingVersion(source, '1.0.48')

        expect(stamped.match(/MARKETING_VERSION = 1\.0\.48;/g)).toHaveLength(2)
        expect(stamped).toContain('SOMETHING_ELSE = keep;')
    })

    it('throws when the anchor is gone rather than silently shipping a stale version', () => {
        expect(() => stampMarketingVersion('NO_VERSION_HERE = 1;', '1.0.48')).toThrow(/anchor is stale/)
    })

    it('is idempotent', () => {
        const once = stampMarketingVersion('MARKETING_VERSION = 1.0;', '1.0.48')
        expect(stampMarketingVersion(once, '1.0.48')).toBe(once)
    })
})

describe('the checked-in Xcode project', () => {
    const pbxproj = fs.readFileSync(PBXPROJ, 'utf8')
    const { version } = require('../../package.json')

    it('carries the version package.json declares', () => {
        const found = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]*);/g)].map((m) => m[1])

        expect(found.length).toBeGreaterThan(0)
        for (const value of found) expect(value).toBe(toMarketingVersion(version))
    })

    it('uses three components, so releases differ in the last number', () => {
        const found = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]*);/g)].map((m) => m[1])

        for (const value of found) expect(value).toMatch(/^\d+\.\d+\.\d+$/)
    })
})
