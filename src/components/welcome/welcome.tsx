'use client'
import * as global_components from '@/components/global'
import * as welcomePages from './components'
import { useEffect } from 'react'
import { useConnections, useConnectors } from 'wagmi'

export function welcomePage() {
    const connections = useConnections()
    const x = useConnectors()
    useEffect(() => {
        console.log(document.referrer)
        console.log(connections)
        console.log(x)
    }, [connections, x])

    return (
        <global_components.PageWrapper>
            <welcomePages.Welcome />
        </global_components.PageWrapper>
    )
}
