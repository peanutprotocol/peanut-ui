import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
    alignItems?: 'start' | 'center'
}

const PageContainer = (props: PageContainerProps) => {
    return (
        <div
            className={twMerge(
                // desktop = the same centered mobile column (no sidebar offset — DS 13)
                'flex min-h-[inherit] w-full items-start justify-center *:w-full md:*:max-w-xl',
                props.alignItems === 'center' ? 'items-center' : 'items-start',
                props.className
            )}
        >
            {props.children}
        </div>
    )
}

PageContainer.displayName = 'PageContainer'

export { PageContainer }
export default PageContainer
