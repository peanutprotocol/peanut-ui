/**
 * Slava, 2026-10-26: a build from any branch but main is a build for testing.
 * It shows the testing ribbon and takes OTAs from its branch's own channel.
 */
const { buildBranch, isTestBuild, testOtaChannel } = require('../build-branch.cjs')

describe('buildBranch', () => {
    it('takes an explicit branch first', () => {
        expect(
            buildBranch({ PEANUT_BUILD_BRANCH: ' innolope/kyc ', GITHUB_ACTIONS: 'true', GITHUB_REF_NAME: 'main' })
        ).toBe('innolope/kyc')
    })

    it('in CI, names the pull request or the pushed branch, and treats a tag as a release', () => {
        expect(buildBranch({ GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: 'feat/x', GITHUB_REF_NAME: '3620/merge' })).toBe(
            'feat/x'
        )
        expect(buildBranch({ GITHUB_ACTIONS: 'true', GITHUB_REF_NAME: 'dev' })).toBe('dev')
        expect(buildBranch({ GITHUB_ACTIONS: 'true', GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'ota-1.0.56' })).toBe(
            'main'
        )
    })
})

describe('a build for testing', () => {
    it('is any known branch but main', () => {
        expect(isTestBuild('main')).toBe(false)
        expect(isTestBuild('')).toBe(false)
        expect(isTestBuild('dev')).toBe(true)
        expect(isTestBuild('innolope/kyc-document-selection')).toBe(true)
    })

    it("takes OTAs from its branch's own channel", () => {
        expect(testOtaChannel('innolope/KYC_document.selection')).toMatch(
            /^test-innolope-kyc-document-selection-[a-f0-9]+$/
        )
        expect(testOtaChannel(`feat/${'x'.repeat(80)}`).length).toBeLessThanOrEqual(60)
    })

    it('distinguishes exact branch names despite punctuation, case and truncation', () => {
        const longStem = `innolope/${'a'.repeat(80)}`
        const branches = [
            'feature/kyc',
            'feature-kyc',
            'feature_kyc',
            'feature.KYC',
            'feature.kyc',
            `${longStem}-one`,
            `${longStem}-two`,
        ]
        const channels = branches.map(testOtaChannel)
        expect(new Set(channels).size).toBe(branches.length)
        for (const [index, channel] of channels.entries()) {
            expect(channel).toBe(testOtaChannel(branches[index]))
            expect(channel).toMatch(/^test-[a-z0-9-]+-[a-f0-9]+$/)
            expect(channel.length).toBeLessThanOrEqual(60)
        }
    })
})
