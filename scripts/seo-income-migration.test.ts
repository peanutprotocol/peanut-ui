import inventory from './seo-income-migration.json'
import { checkIncomeMigration } from './seo-income-migration'

const finalFiles = () => new Set([...inventory.retainedPublished, ...inventory.retainedUnpublished])
const finalPublished = () => new Set(inventory.retainedPublished)
const oldFiles = () => new Set([...finalFiles(), ...inventory.retired])
const oldPublished = () => new Set([...finalPublished(), ...inventory.retired])

describe('approved SEO corpus transition', () => {
    it('accepts the original corpus without reducing its count baseline', () => {
        expect(checkIncomeMigration(oldFiles(), oldPublished())).toEqual({ errors: [], retirementAllowance: 0 })
        expect(oldPublished().size).toBe(790)
    })

    it('accepts the complete final corpus with only its exact removal allowance', () => {
        expect(checkIncomeMigration(finalFiles(), finalPublished())).toEqual({
            errors: [],
            retirementAllowance: 352,
        })
        expect(finalPublished().size).toBe(438)
    })

    it.each(['help/verification/en.md', 'legal/privacy/en.md'])('rejects a missing protected file: %s', (file) => {
        const files = finalFiles()
        const published = finalPublished()
        expect(files.has(file)).toBe(true)
        files.delete(file)
        published.delete(file)
        files.add('blog/unrelated-new-page/en.md')
        published.add('blog/unrelated-new-page/en.md')
        expect(checkIncomeMigration(files, published)).toEqual({
            errors: [`Required content is missing: ${file}`],
            retirementAllowance: 0,
        })
    })

    it('rejects a partial retirement even when the published count exceeds the old floor', () => {
        const files = oldFiles()
        const published = oldPublished()
        files.delete(inventory.retired[0])
        published.delete(inventory.retired[0])
        expect(published.size).toBeGreaterThan(740)
        const result = checkIncomeMigration(files, published)
        expect(result.errors).toEqual([expect.stringContaining('Incomplete SEO retirement')])
        expect(result.retirementAllowance).toBe(0)
    })

    it('rejects unpublishing a retained article', () => {
        const published = finalPublished()
        published.delete('help/verification/en.md')
        expect(checkIncomeMigration(finalFiles(), published).errors).toContain(
            'Required content is unpublished: help/verification/en.md'
        )
    })

    it('rejects unpublishing removal files in place of deleting their locale siblings', () => {
        const published = oldPublished()
        published.delete(inventory.retired[0])
        expect(checkIncomeMigration(oldFiles(), published).errors).toContain(
            `Retirement requires removing the file, not unpublishing it: ${inventory.retired[0]}`
        )
    })

    it('preserves the Yape explainer and deferred consolidation guides', () => {
        for (const topic of [
            'pay-with/yape',
            'deposit/crypto-com',
            'deposit/lemon',
            'deposit/polygon',
            'deposit/solana',
            'receive-from/spain',
            'receive-from/united-states',
            'withdraw/arbitrum',
            'withdraw/polygon',
        ]) {
            expect(inventory.retainedPublished).toContain(`${topic}/en.md`)
            expect(inventory.retired.some((file) => file.startsWith(`${topic}/`))).toBe(false)
        }
    })

    it('rejects each single-file partial retirement', () => {
        for (const file of inventory.retired) {
            const files = oldFiles()
            const published = oldPublished()
            files.delete(file)
            published.delete(file)
            const result = checkIncomeMigration(files, published)
            expect(result.errors).toEqual([expect.stringContaining('Incomplete SEO retirement')])
            expect(result.retirementAllowance).toBe(0)
        }
    })
})
