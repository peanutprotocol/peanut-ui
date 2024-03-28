'use client'
import * as global_components from '@/components/global'
import * as welcomePages from './components'
import { useConnectorClient } from 'wagmi'
import { useConnections, useAccount } from 'wagmi'

export function welcomePage() {
    // const isMantleUrl = utils.isMantleInUrl()
    const result = useConnectorClient()
    const result2 = useConnections()
    const { address } = useAccount()

    console.log(result)
    console.log(result2.find((obj) => obj.accounts.includes((address ?? '') as `0x${string}`))?.connector.id == 'safe')
    console.log(address)

    return (
        <global_components.PageWrapper>
            <welcomePages.Welcome />{' '}
        </global_components.PageWrapper>
    )
}
