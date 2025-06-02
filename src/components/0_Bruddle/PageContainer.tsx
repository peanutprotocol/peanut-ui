import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const PageContainer = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={twMerge(
                'flex w-full items-center justify-center *:w-full md:pl-24 md:*:max-w-xl',
                props.className
            )}
        >
            {props.children}
        </div>
    )
}

export default PageContainer
