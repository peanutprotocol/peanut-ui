import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'

/** The picker chooses the identity document only; a proof of address is collected after approval, as a supplement. */
export const identityDocuments = (route: KycDocumentPlan['routes'][number] | undefined) =>
    route?.documents.filter((d) => d.code === 'IDENTITY') ?? []
