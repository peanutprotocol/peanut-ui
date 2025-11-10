import React from 'react'
import Card from '../Card'
import { Icon, type IconName } from '../Icons/Icon'
import { twMerge } from 'tailwind-merge'

interface EmptyStateProps {
    icon: IconName
    title: string | React.ReactNode
    description?: string
    cta?: React.ReactNode
    containerClassName?: HTMLDivElement['className']
}

// EmptyState component - Used for dispalying when there's no data in a certain scneario and we want to inform users with a cta (optional)
export default function EmptyState({ title, description, icon, cta, containerClassName }: EmptyStateProps) {
    return (
        <Card position="single" className="p-0">
            <div className={twMerge('flex flex-col items-center justify-center gap-2 px-4 py-6', containerClassName)}>
                <div className="rounded-full bg-primary-1 p-2">
                    <Icon name={icon} size={16} />
                </div>
                <div className="text-center">
                    <div className="font-medium">{title}</div>
                    {description && <div className="text-sm text-grey-1">{description}</div>}
                    {cta && cta}
                </div>
            </div>
        </Card>
    )
}
