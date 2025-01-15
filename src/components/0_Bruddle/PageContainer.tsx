import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const PageContainer = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div className="flex min-h-[calc(100dvh-3rem)] w-full items-center justify-center py-6 *:w-full md:*:w-2/5">
            <div
                className={twMerge('mx-auto flex h-full w-full items-center justify-evenly *:w-full', props.className)}
            >
                {props.children}
            </div>
        </div>
    )
}

export default PageContainer
