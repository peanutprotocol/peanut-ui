'use client'
import * as global_components from '@/components/global'
import * as components from '@/components'

export default function Home() {
    return (
        <global_components.PageWrapper>
            <components.Send />
            <components.SendWidget />
        </global_components.PageWrapper>
    )
}
