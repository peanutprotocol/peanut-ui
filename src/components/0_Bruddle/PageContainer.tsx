import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const PageContainer = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={twMerge(
                'flex h-[120%] w-full flex-col items-center sm:h-full sm:justify-center',
                props.className
            )}
        >
            {props.children}
        </div>
    )
}

export default PageContainer
