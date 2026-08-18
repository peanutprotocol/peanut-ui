import PeanutMascot from '@/components/Global/PeanutMascot'
import { useMemo } from 'react'

interface NoDataEmptyStateProps {
    message: string
    cta?: React.ReactNode
    animSize?: 'sm' | 'md' | 'lg' | 'xl'
}

const NoDataEmptyState = ({ message, cta, animSize }: NoDataEmptyStateProps) => {
    const mascotSizeClass = useMemo(() => {
        switch (animSize) {
            case 'sm':
                return 'size-24'
            case 'md':
                return 'size-32'
            case 'lg':
                return 'size-48'
            case 'xl':
                return 'size-64'
            default:
                return 'size-24'
        }
    }, [animSize])

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <PeanutMascot pose="worried" alt="Peanutman crying 😭" className={mascotSizeClass} />
            <div>{message}</div>
            {cta && cta}
        </div>
    )
}

export default NoDataEmptyState
