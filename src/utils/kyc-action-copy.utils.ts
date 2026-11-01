import type { NextAction } from '@/types/capabilities'
import { EEA_UPLIFT_REQUIREMENT_KEYS } from '@/utils/eea-uplift.utils'

const QUESTIONNAIRE_LEVELS = new Set([
    'eea_uplift',
    'eea_uplift_with_tin',
    'source_of_funds',
    'tax_identification_number',
    'birth_details',
    'bridge_answers_rejected',
])

export function kycActionCtaKey(action?: NextAction, reasonCode?: string | null) {
    if (action?.kind === 'questions') return 'initiate.ctaAnswerQuestion' as const
    if (reasonCode === 'eea_tin_reupload') return 'initiate.ctaUploadDocument' as const
    const levels = [action?.levelKey, action?.key.split(':').pop(), reasonCode]
    const requirements = [action?.requirementKey, ...(action?.requirementKeys ?? [])]
    return levels.some((level) => level && QUESTIONNAIRE_LEVELS.has(level)) ||
        requirements.some((key) => key && EEA_UPLIFT_REQUIREMENT_KEYS.has(key))
        ? ('initiate.ctaAnswerQuestions' as const)
        : ('initiate.ctaUploadDocument' as const)
}
