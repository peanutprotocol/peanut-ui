import { setupSteps } from '@/components/Setup/Setup.consts'
import { setupProgress } from '../setupProgress'

describe('setupProgress (v7 progress head start)', () => {
    it('Landing shows no dots', () => {
        expect(setupProgress(setupSteps, 'landing')).toBeNull()
    })

    it('Landing counts as a done step: the first screen after it already has one filled dot', () => {
        // index = the number of done dots; Bank details is the second step
        expect(setupProgress(setupSteps, 'advantage-fees')).toEqual({ index: 1, total: setupSteps.length })
    })

    it('the last step keeps its place in a list with Landing counted', () => {
        const last = setupSteps[setupSteps.length - 1]
        expect(setupProgress(setupSteps, last.screenId)).toEqual({
            index: setupSteps.length - 1,
            total: setupSteps.length,
        })
    })

    it('a filtered list (no Card, no Invite) counts only its own steps', () => {
        const steps = setupSteps.filter((step) => !['advantage-card', 'invite'].includes(step.screenId))
        expect(setupProgress(steps, 'residence')).toEqual({ index: 2, total: steps.length })
    })

    it('a step that is not in the list shows no dots', () => {
        const steps = setupSteps.filter((step) => step.screenId !== 'invite')
        expect(setupProgress(steps, 'invite')).toBeNull()
    })
})
