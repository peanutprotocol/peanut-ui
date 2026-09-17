export async function verifiedAccessIdentity(context, audience) {
    const access = context?.access
    if (!access || !audience || access.aud !== audience || typeof access.getIdentity !== 'function') return null
    try {
        const identity = await access.getIdentity()
        const email = identity?.email?.toLowerCase()
        if (email?.endsWith('@peanut.me')) return email
        const commonName = typeof identity?.common_name === 'string' ? identity.common_name.trim() : ''
        return identity?.service_token_status === true && commonName ? `service:${commonName}` : null
    } catch {
        return null
    }
}

export async function constantTimeEqual(left, right) {
    const encoder = new TextEncoder()
    const [leftDigest, rightDigest] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(left)),
        crypto.subtle.digest('SHA-256', encoder.encode(right)),
    ])
    const leftBytes = new Uint8Array(leftDigest)
    const rightBytes = new Uint8Array(rightDigest)
    let difference = leftBytes.length ^ rightBytes.length
    for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index++)
        difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
    return difference === 0
}
