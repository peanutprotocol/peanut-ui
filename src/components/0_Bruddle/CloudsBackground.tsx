import { useEffect, useState } from 'react'

const cloud1 = (
    <svg width="209" height="98" viewBox="0 0 209 98" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M21.2631 54.3739C21.0567 53.6188 20.9363 52.8122 20.9363 51.9884C20.9363 47.4062 24.4103 43.6478 28.8818 43.1672C27.9015 40.1124 27.3856 36.8689 27.3856 33.488C27.3856 15.8457 41.7116 1.54993 59.3912 1.54993C73.9063 1.54993 86.1685 11.212 90.0725 24.4266C91.8095 23.1223 93.9765 22.3328 96.3154 22.3328C102.06 22.3328 106.72 26.9837 106.72 32.7157C106.72 32.7672 106.72 32.8187 106.72 32.8702C107.443 32.9388 108.148 33.059 108.853 33.1791C115.044 28.6484 122.525 25.7995 130.608 25.3876C149.956 24.3923 166.535 36.9203 171.677 54.3396C173.879 52.6749 176.613 51.6795 179.588 51.6795C186.88 51.6795 192.779 57.5831 192.779 64.8426C192.779 64.9112 192.779 64.9627 192.779 65.0313C192.951 65.0313 193.14 65.0657 193.312 65.0828C213.125 67.1937 211.388 96.5919 191.472 96.5919H23.2065C11.4946 96.5919 2.00125 87.1185 2.00125 75.4314C2.00125 64.3964 10.4627 55.4444 21.2631 54.4661V54.3739Z"
            fill="white"
            stroke="black"
            stroke-width="2.53491"
        />
    </svg>
)

const cloud2 = (
    <svg width="209" height="99" viewBox="0 0 209 99" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M187.992 54.5994C188.198 53.8442 188.384 53.2622 188.384 52.4385C188.384 47.8563 184.91 44.0978 180.438 43.6173C181.419 40.5625 181.935 37.3189 181.935 33.9381C181.935 16.2958 167.609 2 149.929 2C135.414 2 123.152 11.6621 119.248 24.8766C117.511 23.5724 115.344 22.7829 113.005 22.7829C107.261 22.7829 102.6 27.4338 102.6 33.1658C102.6 33.2173 102.6 33.2688 102.6 33.3202C101.878 33.3889 101.173 33.509 100.468 33.6292C94.2762 29.0984 86.7951 26.2496 78.712 25.8377C59.3642 24.8423 42.7853 37.3704 37.643 54.7896C35.4417 53.1249 32.7072 52.1296 29.7319 52.1296C22.44 52.1296 16.541 58.0332 16.541 65.2926C16.541 65.3613 16.541 65.4128 16.541 65.4814C16.369 65.4814 16.1799 65.5157 16.0079 65.5329C-3.80428 67.6438 -2.06728 97.0419 17.8481 97.0419H186.114C197.826 97.0419 207.319 87.5686 207.319 75.8814C207.319 64.8464 198.858 55.785 188.057 54.8068L187.992 54.5994Z"
            fill="white"
            stroke="black"
            stroke-width="2.53491"
        />
    </svg>
)

interface CloudProps {
    left: number
    top: number
    scale?: number
    variant: 1 | 2
}

const Cloud: React.FC<CloudProps> = ({ left, top, scale = 1, variant }) => {
    const CloudSvg = variant === 1 ? cloud1 : cloud2

    return (
        <div
            style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                transform: `scale(${scale})`,
                zIndex: 0,
            }}
        >
            {CloudSvg}
        </div>
    )
}

const CloudsBackground: React.FC = () => {
    // Separate cloud configurations for desktop and mobile
    const desktopClouds = [
        { left: -5, top: 10, scale: 1.2, variant: 1 as const },
        { left: 20, top: 5, scale: 0.8, variant: 2 as const },
        { left: 45, top: 15, scale: 1, variant: 1 as const },
        { left: 70, top: 8, scale: 0.9, variant: 2 as const },
        { left: 85, top: 12, scale: 1.1, variant: 1 as const },
        { left: -8, top: 60, scale: 1, variant: 2 as const },
        { left: 30, top: 65, scale: 1.2, variant: 1 as const },
        { left: 60, top: 70, scale: 0.8, variant: 2 as const },
        { left: 90, top: 55, scale: 1, variant: 1 as const },
    ]

    const mobileClouds = [
        { left: -5, top: 10, scale: 0.8, variant: 1 as const },
        { left: 30, top: 5, scale: 0.6, variant: 2 as const },
        { left: 70, top: 15, scale: 0.7, variant: 1 as const },
        { left: -8, top: 60, scale: 0.8, variant: 2 as const },
        { left: 60, top: 70, scale: 0.6, variant: 1 as const },
    ]

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768)
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const clouds = isMobile ? mobileClouds : desktopClouds

    return (
        <div style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' }}>
            {clouds.map((cloud, index) => (
                <Cloud key={index} {...cloud} />
            ))}
        </div>
    )
}

export default CloudsBackground
