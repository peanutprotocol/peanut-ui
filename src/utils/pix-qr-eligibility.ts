type Residence = {
    verified?: { country?: string | null } | null
    declared?: { country?: string | null } | null
}

export function isPixQrResidenceBlocked(residence?: Residence | null): boolean {
    const country = (residence?.verified?.country?.trim() || residence?.declared?.country?.trim())?.toUpperCase()
    return country === 'BR' || country === 'BRA'
}
