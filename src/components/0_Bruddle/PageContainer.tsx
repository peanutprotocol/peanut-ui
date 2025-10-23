import { type HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
    alignItems?: 'start' | 'center'
}

const PageContainer = (props: PageContainerProps) => {
    return (
        <div
            className={twMerge(
                'flex min-h-[inherit] w-full items-start justify-center *:w-full md:pl-24 md:*:max-w-xl',
                props.alignItems === 'center' ? 'items-center' : 'items-start',
                props.className
            )}
        >
            {props.children}
        </div>
    )
}

export default PageContainer
