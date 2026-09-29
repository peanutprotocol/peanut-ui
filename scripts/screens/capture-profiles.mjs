export const CAPTURE_PROFILES = Object.freeze({
    '393x852': Object.freeze({
        width: 393,
        height: 852,
        browserProfile: 'iPhone 15 Pro',
        device: Object.freeze({
            platform: 'ios',
            label: 'iPhone',
            cutout: 'dynamic-island',
            safeArea: Object.freeze({ top: 59, right: 0, bottom: 34, left: 0 }),
        }),
    }),
    '440x956': Object.freeze({
        width: 440,
        height: 956,
        browserProfile: 'iPhone 15 Pro Max',
        device: Object.freeze({
            platform: 'ios',
            label: 'iPhone Pro Max',
            cutout: 'dynamic-island',
            safeArea: Object.freeze({ top: 62, right: 0, bottom: 34, left: 0 }),
        }),
    }),
    '360x800': Object.freeze({
        width: 360,
        height: 800,
        browserProfile: 'Pixel 7',
        device: Object.freeze({
            platform: 'android',
            label: 'Android',
            cutout: 'punch-hole',
            safeArea: Object.freeze({ top: 24, right: 0, bottom: 24, left: 0 }),
        }),
    }),
    '320x712': Object.freeze({
        width: 320,
        height: 712,
        browserProfile: 'Pixel 7',
        device: Object.freeze({
            platform: 'android',
            label: 'Android small',
            cutout: 'punch-hole',
            safeArea: Object.freeze({ top: 24, right: 0, bottom: 24, left: 0 }),
        }),
    }),
})

export function captureProfile(name = '393x852') {
    const dimensions = CAPTURE_PROFILES[name]
    if (!dimensions) throw new Error(`Unsupported capture profile: ${name}`)
    return { name, ...dimensions }
}
