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

    // Chip, ui#3904: a new branch tracks origin/main or origin/dev until its first push.
    it('locally, names the checked-out branch, not the branch it tracks', () => {
        const checkout = (head, upstream) => (command) =>
            command.includes('@{u}') ? upstream : command === 'rev-parse --abbrev-ref HEAD' ? head : ''
        expect(buildBranch({}, checkout('feat/new-card', 'origin/main'))).toBe('feat/new-card')
        expect(buildBranch({}, checkout('feat/new-card', 'origin/dev'))).toBe('feat/new-card')
        expect(buildBranch({}, checkout('main', 'origin/main'))).toBe('main')
    })

    it('refuses a detached or git-less local build unless PEANUT_BUILD_BRANCH names it', () => {
        expect(() => buildBranch({}, () => 'HEAD')).toThrow(/PEANUT_BUILD_BRANCH/)
        expect(() => buildBranch({}, () => '')).toThrow(/PEANUT_BUILD_BRANCH/)
        expect(buildBranch({ PEANUT_BUILD_BRANCH: 'innolope/kyc' }, () => 'HEAD')).toBe('innolope/kyc')
        expect(buildBranch({ PEANUT_BUILD_BRANCH: 'main' }, () => 'HEAD')).toBe('main')
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
