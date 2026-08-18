export function getIOSMajorVersion(): number | null {
    if (typeof navigator === 'undefined') return null
    const match = navigator.userAgent.match(/(?:CPU OS|iPhone OS)\s+(\d+)/i)
    return match ? parseInt(match[1], 10) : null
}
