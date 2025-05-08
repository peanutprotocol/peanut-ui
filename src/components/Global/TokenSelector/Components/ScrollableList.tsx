import React, { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface ScrollableListProps {
    children: ReactNode
    className?: string
    maxHeight?: string // e.g., 'max-h-[50vh]' or 'max-h-96'
}

const ScrollableList: React.FC<ScrollableListProps> = ({ children, className, maxHeight = '' }) => {
    return (
        <div className={twMerge('overflow-y-auto pb-2 pr-1', maxHeight, className)}>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    )
}

export default ScrollableList
