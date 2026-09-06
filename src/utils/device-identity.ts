// Device identity for performance segmentation. PostHog's own device context is
// derived from the User-Agent, which Chrome's UA reduction has hollowed out:
// every Android resolves to the literal `$device` "Android" and `$os_version` is
// absent on all but a handful of events, so a slow-device cohort cannot be built
// from it. These properties restore the model and OS version from sources the
// reduction doesn't touch.

import { isNativeBridge } from '@/utils/capacitor'

export type DeviceClass = 'low' | 'mid' | 'high' | 'unknown'

export type DeviceIdentity = {
    device_class: DeviceClass
    device_model?: string
    device_manufacturer?: string
    device_os_version?: string
    device_webview_version?: string
    device_memory_gb?: number
    device_cores?: number
    device_screen?: string
}

/**
 * Memory is the only capability signal available across enough of the fleet to
 * rank devices against one another: Chromium reports it in fixed buckets
 * (0.25–8 GB), which is the split that separates a budget Android from a
 * flagship. WebKit exposes neither it nor a usable substitute — an iPhone's
 * `hardwareConcurrency` is small on fast hardware — so iOS deliberately stays
 * `unknown` instead of being ranked by a signal that would read every iPhone as
 * slow. Segment iOS by `device_model` (native) or `device_screen` (PWA).
 */
export function classifyDevice(memoryGb: number | undefined): DeviceClass {
    if (memoryGb === undefined) return 'unknown'
    if (memoryGb <= 2) return 'low'
    if (memoryGb <= 4) return 'mid'
    return 'high'
}

function screenDescriptor(): string | undefined {
    const { width, height } = window.screen ?? {}
    if (!width || !height) return undefined
    return `${width}x${height}@${Math.round((window.devicePixelRatio || 1) * 100) / 100}`
}

async function nativeIdentity(): Promise<Partial<DeviceIdentity>> {
    const { Device } = await import('@capacitor/device')
    const info = await Device.getInfo()
    return {
        device_model: info.model || undefined,
        device_manufacturer: info.manufacturer || undefined,
        device_os_version: info.osVersion || undefined,
        device_webview_version: info.webViewVersion || undefined,
    }
}

async function clientHintIdentity(): Promise<Partial<DeviceIdentity>> {
    const uaData = navigator.userAgentData
    if (!uaData?.getHighEntropyValues) return {}
    const hints = await uaData.getHighEntropyValues(['model', 'platformVersion'])
    // Desktop Chromium answers with an empty model rather than omitting it.
    return {
        device_model: hints.model || undefined,
        device_os_version: hints.platformVersion || undefined,
    }
}

async function readIdentity(): Promise<DeviceIdentity> {
    const memoryGb = navigator.deviceMemory
    const base: DeviceIdentity = {
        device_class: classifyDevice(memoryGb),
        device_memory_gb: memoryGb,
        device_cores: navigator.hardwareConcurrency || undefined,
        device_screen: screenDescriptor(),
    }
    try {
        // The bridge names the exact hardware (`iPhone14,3`, `SM-A505G`); client
        // hints are the only way to see through the UA reduction on the web.
        return { ...base, ...(await (isNativeBridge() ? nativeIdentity() : clientHintIdentity())) }
    } catch {
        // an older binary without the plugin, or a browser that refuses the
        // hints — the buckets below are still worth reporting on their own
        return base
    }
}

let identity: Promise<DeviceIdentity> | null = null

/** Resolved once per document; the native branch costs a bridge round-trip. */
export function resolveDeviceIdentity(): Promise<DeviceIdentity> {
    if (typeof window === 'undefined') return Promise.resolve({ device_class: 'unknown' })
    if (!identity) identity = readIdentity()
    return identity
}
