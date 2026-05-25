import { MANTECA_US_NATIONALITY_RESTRICTION_CODE } from '@/constants/manteca.consts'

function getMetadataRecord(metadata: unknown): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {}
}

export function hasMantecaUsNationalityRestrictionMetadata(metadataList: unknown[]): boolean {
    return metadataList.some(
        (metadata) => getMetadataRecord(metadata).restrictionCode === MANTECA_US_NATIONALITY_RESTRICTION_CODE
    )
}
