import { setupSteps } from '@/components/Setup/Setup.consts'
import { filterSetupStepsForResidence } from '../filterSetupSteps'

const restrictions = { full: new Set(['RU']), bankingOnly: new Set(['JP']), cardOnly: new Set(['IN']) }
const idsFor = (residence: string) =>
    filterSetupStepsForResidence(setupSteps, restrictions, residence).map((step) => step.screenId)

it('shows bank then card before funding for an eligible residence', () => {
    const ids = idsFor('PT')
    expect(ids.slice(ids.indexOf('residence'), ids.indexOf('funding-methods') + 1)).toEqual([
        'residence',
        'advantage-bank',
        'advantage-card',
        'funding-methods',
    ])
    expect(ids).not.toContain('sign-test-transaction')
    expect(setupSteps.find((step) => step.screenId === 'advantage-control')?.showBackButton).toBe(false)
})
it('shows bank without card for a card-restricted residence', () => {
    const ids = idsFor('IN')
    expect(ids[ids.indexOf('funding-methods') - 1]).toBe('advantage-bank')
    expect(ids).not.toContain('advantage-card')
})
it('shows an eligible card without banking for Japan', () => {
    expect(idsFor('JP')).not.toContain('advantage-bank')
    expect(idsFor('JP')).toContain('advantage-card')
})
it.each(['RU', ''])('skips both benefits when unavailable or residence unknown (%s)', (residence) => {
    expect(idsFor(residence)).not.toContain('advantage-bank')
    expect(idsFor(residence)).not.toContain('advantage-card')
})
