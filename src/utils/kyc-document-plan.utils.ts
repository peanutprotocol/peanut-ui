import type { KycDocumentPlan, KycFeatures } from '@/app/actions/types/kyc-workflow.types'

/** The picker's features in the order it lists them. */
export const KYC_FEATURE_KEYS = ['qr', 'local', 'bank', 'card'] as const satisfies readonly (keyof KycFeatures)[]

/** The picker chooses the identity document only; a proof of address is collected after approval, as a supplement. */
export const identityDocuments = (route: KycDocumentPlan['routes'][number] | undefined) =>
    route?.documents.filter((d) => d.code === 'IDENTITY') ?? []
