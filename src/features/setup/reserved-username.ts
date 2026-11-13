export function isReservedSignupUsername(username: string): boolean {
    const normalized = username.toLowerCase()
    return normalized.includes('peanut') || ['official', 'verified', 'helpdesk', 'customercare'].includes(normalized)
}
