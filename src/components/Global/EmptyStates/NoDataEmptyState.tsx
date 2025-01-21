import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import Image from 'next/image'
import { useMemo } from 'react'

interface NoDataEmptyStateProps {
    message: string
    cta?: React.ReactNode
    animSize?: 'sm' | 'md' | 'lg' | 'xl'
}

const NoDataEmptyState = ({ message, cta, animSize }: NoDataEmptyStateProps) => {
    const getAnimSize = useMemo(() => {
        switch (animSize) {
            case 'sm':
                return 96
            case 'md':
                return 128
            case 'lg':
                return 192
            case 'xl':
                return 256
            default:
                return 96
        }
    }, [animSize])

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <Image
                src={PEANUTMAN_CRY.src}
                alt="Peanutman crying 😭"
                width={getAnimSize}
                height={getAnimSize}
                className=""
            />
            <div>{message}</div>
            {cta && cta}
        </div>
    )
}

export default NoDataEmptyState
