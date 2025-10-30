import React from 'react'
import Card from '../Card'
import { twMerge } from 'tailwind-merge'

interface InfoCardProps {
    children: React.ReactNode
    variant?: 'warning' | 'error' | 'info' | 'default'
    className?: string
}

const InfoCard = ({ children, variant = 'default', className }: InfoCardProps) => {
    const getClassNames = () => {
        switch (variant) {
            case 'warning':
                return 'border-yellow-9 bg-yellow-10 text-yellow-11'
            case 'error':
                return 'border-error-5 bg-error-6 text-error'
            case 'info':
                return 'border-secondary-7 bg-secondary-9 text-black'
            case 'default':
                return 'border-grey-1 bg-grey-4 text-black'
            default:
                return 'border-grey-1 bg-grey-4 text-black'
        }
    }

    return <Card className={twMerge('flex w-full flex-col gap-2 border', getClassNames(), className)}>{children}</Card>
}

export default InfoCard
