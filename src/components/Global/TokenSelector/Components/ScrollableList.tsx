import React, { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

interface ScrollableListProps {
    children: ReactNode
    className?: string
    maxHeight?: string // e.g., 'max-h-[50vh]' or 'max-h-96'
}

const ScrollableList: React.FC<ScrollableListProps> = ({ children, className, maxHeight = '' }) => {
    return (
        <div className={twMerge('overflow-y-auto pr-1 pb-2', maxHeight, className)}>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    )
}

export default ScrollableList
