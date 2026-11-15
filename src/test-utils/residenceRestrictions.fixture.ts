import { DEMO_RESIDENCE_RESTRICTIONS } from '@/utils/demo-kyc'
import { parseResidenceRestrictionSets } from '@/utils/residence-restriction-sets'

export const RESIDENCE_RESTRICTION_SETS = parseResidenceRestrictionSets(DEMO_RESIDENCE_RESTRICTIONS)!
