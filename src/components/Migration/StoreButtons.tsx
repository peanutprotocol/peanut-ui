'use client'
import { Button } from '@/components/0_Bruddle/Button'
import DownloadQR from '@/components/Migration/DownloadQR'
import { STORE_NAME, type MigrationSurface } from '@/constants/migration.consts'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { openStore, storeForDevice, storeIcon } from '@/utils/migration.utils'

// one primary CTA per device: the visitor's store on mobile, scan-to-download QR on desktop.
export default function StoreButtons({ surface }: { surface: MigrationSurface }) {
    const { deviceType } = useDeviceType()
    const store = storeForDevice(deviceType)
    if (!store) return <DownloadQR surface={surface} />
    return (
        <Button
            variant="primary"
            shadowSize="4"
            icon={storeIcon(store)}
            className="h-11 w-full"
            onClick={() => openStore(store, surface)}
        >
            {STORE_NAME[store]}
        </Button>
    )
}
