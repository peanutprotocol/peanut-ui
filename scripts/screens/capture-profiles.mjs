export const CAPTURE_PROFILES = Object.freeze({
    '393x852': Object.freeze({ width: 393, height: 852 }),
    '440x956': Object.freeze({ width: 440, height: 956 }),
    '360x800': Object.freeze({ width: 360, height: 800 }),
    '320x712': Object.freeze({ width: 320, height: 712 }),
})

export function captureProfile(name = '393x852') {
    const dimensions = CAPTURE_PROFILES[name]
    if (!dimensions) throw new Error(`Unsupported capture profile: ${name}`)
    return { name, ...dimensions }
}
