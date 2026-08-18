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
                return 'h-24 w-auto'
            case 'md':
                return 'h-32 w-auto'
            case 'lg':
                return 'h-48 w-auto'
            case 'xl':
                return 'h-64 w-auto'
            default:
                return 'h-24 w-auto'
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
