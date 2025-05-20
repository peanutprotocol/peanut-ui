import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const PageContainer = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={twMerge('flex w-full items-center justify-center *:w-full md:pl-24 md:*:w-2/5', props.className)}
        >
            {props.children}
        </div>
    )
}

export default PageContainer
