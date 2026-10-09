import { setupSteps } from '@/components/Setup/Setup.consts'
import { filterSetupStepsForResidence, setupFeatureScreensForResidence } from '../filterSetupSteps'

const restrictions = { full: new Set(['RU']), bankingOnly: new Set(['JP']), cardOnly: new Set(['IN']) }
it.each([
    ['PT', ['advantage-card']],
    ['AR', ['advantage-local']],
    ['BR', ['advantage-local']],
    [' ar ', ['advantage-local']],
    ['IN', ['advantage-exchange']],
    ['JP', ['advantage-exchange', 'advantage-card']],
    ['RU', ['advantage-exchange', 'advantage-people']],
    ['', ['advantage-exchange', 'advantage-people']],
])('keeps the remaining ordered feature screens for %s', (residence, expected) => {
    expect(setupFeatureScreensForResidence(restrictions, residence as string)).toEqual(expected)
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence as string).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('residence') + 1, ids.indexOf('passkey-permission'))).toEqual(expected)
    expect(ids).not.toContain('advantage-bank')
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('sign-test-transaction')
    expect(setupSteps.find((step) => step.screenId === 'advantage-control')?.showBackButton).toBe(true)
})
it('replaces a restricted bank slot with a backup even for Argentina and Brazil', () => {
    const sets = { ...restrictions, bankingOnly: new Set(['AR', 'BR']) }
    for (const residence of ['AR', 'BR'])
        expect(setupFeatureScreensForResidence(sets, residence)).toEqual(['advantage-exchange', 'advantage-local'])
})
