// Polyfill crypto.randomUUID for browsers that don't support it
// This fixes the "@daimo/pay" library which requires crypto.randomUUID()
// Implementation follows the standard UUID v4 format (RFC 4122)
// Uses crypto.getRandomValues (CSRNG) for secure random generation

if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && !crypto.randomUUID) {
    // Standard UUID v4 polyfill using crypto.getRandomValues (CSRNG)
    // Based on: https://stackoverflow.com/a/2117523 and https://github.com/uuidjs/uuid
    // @ts-ignore - Adding polyfill for crypto.randomUUID
    crypto.randomUUID = function randomUUID(): string {
        // Generate 16 random bytes
        const bytes = new Uint8Array(16)
        crypto.getRandomValues(bytes)

        // Set version (4) and variant bits according to RFC 4122
        bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10

        // Convert to UUID string format
        const hexBytes = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))

        return [
            hexBytes.slice(0, 4).join(''),
            hexBytes.slice(4, 6).join(''),
            hexBytes.slice(6, 8).join(''),
            hexBytes.slice(8, 10).join(''),
            hexBytes.slice(10, 16).join(''),
        ].join('-')
    }
}

export {}
