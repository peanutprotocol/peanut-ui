import { useEffect } from 'react'
import { isMobile } from 'react-device-detect'

export function CardWrapper({
    children,
    mb = ' mb-48 ',
    mt = ' mt-5 ',
    shadow = true,
    redPacket = false,
}: {
    children: React.ReactNode
    mb?: string
    mt?: string
    shadow?: boolean
    redPacket?: boolean
}) {
    return (
        <div
            className={
                'center-xy brutalborder relative mx-auto mr-4 flex w-10/12 flex-col items-center bg-white px-4 py-6 text-black sm:mr-auto lg:w-2/3 xl:w-1/2 ' +
                mb +
                mt
            }
            id={shadow ? 'cta-div' : ''}
        >
            {redPacket ? <div className="absolute -top-12 h-24 w-24 rounded-full border-2 bg-gold "></div> : ''}{' '}
            {children}
        </div>
    )
}
