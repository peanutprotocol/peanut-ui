import borderCloud from '@/assets/illustrations/border-cloud.svg'
import Image from 'next/image'
import { twMerge } from '@/utils/tw'
import { type CSSProperties } from 'react'

export type CloudConfig = {
    top: string
    width: number
    speed: string
    direction: 'ltr' | 'rtl'
    delay?: string
}

const defaultClouds: CloudConfig[] = [
    { top: '10%', width: 180, speed: '38s', direction: 'ltr' },
    { top: '45%', width: 220, speed: '44s', direction: 'ltr' },
    { top: '80%', width: 210, speed: '42s', direction: 'ltr' },
    { top: '25%', width: 200, speed: '40s', direction: 'rtl' },
    { top: '65%', width: 190, speed: '36s', direction: 'rtl' },
]

export function CloudsCss({ clouds = defaultClouds, className }: { clouds?: CloudConfig[]; className?: string }) {
    return (
        <div className={twMerge('absolute top-0 left-0 h-full w-full overflow-hidden', className)}>
            {clouds.map((cloud, i) => (
                <Image
                    key={i}
                    src={borderCloud}
                    alt=""
                    className={`absolute left-0 cloud-${cloud.direction}`}
                    style={
                        {
                            top: cloud.top,
                            width: cloud.width,
                            height: 'auto',
                            '--cloud-speed': cloud.speed,
                            '--cloud-delay': cloud.delay || '0s',
                        } as CSSProperties
                    }
                />
            ))}
        </div>
    )
}
