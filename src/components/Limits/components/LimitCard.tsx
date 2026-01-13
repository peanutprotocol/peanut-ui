'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'

interface LimitCardProps {
    title: string
    items: Array<{
        label: string
        value: string
    }>
    className?: string
}

/**
 * displays a card with limit information
 * used for showing bridge and manteca limits
 */
export default function LimitCard({ title, items, className }: LimitCardProps) {
    return (
        <Card position="single" className={twMerge('space-y-2', className)}>
            <h3 className="font-bold">{title}</h3>
            <div className="space-y-1">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Icon name="check" className="size-4 text-success-1" />
                        <span className="text-sm">
                            <span className="font-medium">{item.label}:</span> {item.value}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    )
}
