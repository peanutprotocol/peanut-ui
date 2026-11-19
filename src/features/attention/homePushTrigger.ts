import { PUSH_PROMPT_TRIGGERS } from '@/constants/push-prompt.consts'
import type { JourneyState } from './types'

/** The Home push ask speaks of the user's money once a deposit has arrived (TASK-25063). */
export const homePushTrigger = (s: Pick<JourneyState, 'firstDepositReceived'>) =>
    s.firstDepositReceived === true ? PUSH_PROMPT_TRIGGERS.FIRST_DEPOSIT : PUSH_PROMPT_TRIGGERS.HOME_FALLBACK
