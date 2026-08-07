'use client'
import { Button } from '@/components/0_Bruddle/Button'
import DownloadQR from '@/components/Migration/DownloadQR'
import { STORE_NAME, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { openStore } from '@/utils/migration.utils'

// one primary CTA per device: the visitor's store on mobile, scan-to-download QR on desktop.
export default function StoreButtons({ surface }: { surface: MigrationSurface }) {
    const { deviceType } = useDeviceType()
    if (deviceType === DeviceType.WEB) return <DownloadQR surface={surface} />
    const store: StoreKind = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
    return (
        <Button
            variant="purple"
            shadowSize="4"
            icon={store === 'ios' ? 'apple-logo' : 'google-play'}
            className="w-full"
            onClick={() => openStore(store, surface)}
        >
            {STORE_NAME[store]}
        </Button>
    )
}
