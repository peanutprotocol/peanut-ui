import { LOADING_STATES } from '@/constants/loadingStates.consts'
import { loadingStateKey } from '../loading-states'
import en from '../messages/en.json'

describe('loadingStateKey', () => {
    it('maps every loading state to an existing catalog key', () => {
        for (const state of LOADING_STATES) {
            const key = loadingStateKey(state)
            expect(en.loadingStates[key]).toBeTruthy()
        }
    })

    it('keeps English catalog copy in sync with the state literals', () => {
        // the union literals double as the English copy at setLoadingState()
        // call sites; 'Idle'/'Loading' aside, drift would show users different
        // text pre- and post-extraction
        for (const state of LOADING_STATES) {
            expect(en.loadingStates[loadingStateKey(state)]).toBe(state)
        }
    })
})
