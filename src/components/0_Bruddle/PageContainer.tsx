import { HTMLAttributes } from 'react'

const PageContainer = (props: HTMLAttributes<HTMLDivElement>) => {
    return <div className="flex w-full items-center justify-center *:w-full md:*:w-2/5">{props.children}</div>
}

export default PageContainer
