'use client'
import { useRef } from 'react'
import { copyIOSHandoff, playStoreUrlWithReferrer, trackDeferredHandoffCreated } from '@/utils/deferred-link'
import { Button } from '@/components/0_Bruddle/Button'
import { STORE_NAME, STORE_URL, type MigrationSurface } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'

/** Show the device's store when known, or both stores on desktop. */
export default function StoreBadges({ surface, payload }: { surface: MigrationSurface; payload?: string }) {
    // Repeated taps must not inflate the handoff count used to measure successful installs.
    const counted = useRef(new Set<string>())
    const countHandoff = (store: 'ios' | 'android', handoff: string) => {
        const key = `${store}:${handoff}`
        if (counted.current.has(key)) return
        counted.current.add(key)
        trackDeferredHandoffCreated(store)
    }
    const { deviceType } = useDeviceType()
    const thisPlatform = deviceType === DeviceType.IOS ? 'ios' : deviceType === DeviceType.ANDROID ? 'android' : null
    const stores = thisPlatform ? ([thisPlatform] as const) : (['ios', 'android'] as const)
    return (
        <div className="flex w-full flex-col gap-3">
            {stores.map((s, i) => (
                <a
                    key={s}
                    href={payload && s === 'android' ? playStoreUrlWithReferrer(payload) : STORE_URL[s]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                        trackStoreClick(s, surface, !!payload)
                        if (!payload) return
                        if (s === 'android') countHandoff(s, payload)
                        else
                            void copyIOSHandoff(payload)
                                .then(() => countHandoff(s, payload))
                                .catch(() => {})
                    }}
                    className="w-full"
                >
                    <Button
                        variant={i === 0 ? 'purple' : 'stroke'}
                        shadowSize="4"
                        size="small"
                        icon={s === 'ios' ? 'apple-logo' : 'google-play'}
                        className="w-full"
                    >
                        {STORE_NAME[s]}
                    </Button>
                </a>
            ))}
        </div>
    )
}
