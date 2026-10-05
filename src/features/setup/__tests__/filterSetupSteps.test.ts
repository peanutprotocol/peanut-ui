import { setupSteps } from '@/components/Setup/Setup.consts'
import { filterSetupStepsForResidence } from '../filterSetupSteps'

const restrictions = { full: new Set(['RU']), bankingOnly: new Set(['JP']), cardOnly: new Set(['IN']) }

it.each(['PT', 'IN'])('shows the bank screen before funding for eligible %s residence', (residence) => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence).map((step) => step.screenId)
    expect(ids[ids.indexOf('funding-methods') - 1]).toBe('advantage-bank')
})

it.each(['JP', 'RU', ''])(
    'skips the bank benefit when banking is unavailable or residence is unknown (%s)',
    (residence) => {
        const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence).map((step) => step.screenId)
        expect(ids).not.toContain('advantage-bank')
        expect(ids[ids.indexOf('funding-methods') - 1]).toBe('residence')
    }
)
