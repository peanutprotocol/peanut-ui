'use client'

import * as global_components from '@/components/global'
// import { useState, useEffect } from 'react'

export function PageWrapper({
    children,
    bgColor = 'bg-teal',
    showMarquee = true,
}: {
    children: React.ReactNode
    bgColor?: string
    showMarquee?: boolean
}) {
    // const [isReady, setIsReady] = useState(false)
    // useEffect(() => {
    //     setIsReady(true)
    // }, [])
    return (
        // isReady && (
        <div className="scrollbar-hide flex min-h-screen flex-col bg-black">
            <global_components.Header showMarquee={showMarquee} />
            <div className={' flex min-h-screen flex-col justify-center  ' + bgColor}>{children}</div>
            <global_components.Footer showMarquee={showMarquee} />
        </div>
        // )
    )
}
