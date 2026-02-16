import borderCloud from '@/assets/illustrations/border-cloud.svg'
import { type CSSProperties } from 'react'

type CloudConfig = {
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

export function CloudsCss({ clouds = defaultClouds }: { clouds?: CloudConfig[] }) {
    return (
        <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
            {clouds.map((cloud, i) => (
                <img
                    key={i}
                    src={borderCloud.src}
                    alt=""
                    className={`absolute left-0 cloud-${cloud.direction}`}
                    style={
                        {
                            top: cloud.top,
                            width: cloud.width,
                            '--cloud-speed': cloud.speed,
                            '--cloud-delay': cloud.delay || '0s',
                        } as CSSProperties
                    }
                />
            ))}
        </div>
    )
}
