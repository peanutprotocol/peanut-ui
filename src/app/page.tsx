import * as global_components from '@/components/global'
import * as components from '@/components'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut-Protocol',
    description: 'Send crypto with links',
    icons: {
        icon: '/logo-favicon.png',
    },
}

export default function Home() {
    return (
        <global_components.PageWrapper>
            <components.Welcome />
        </global_components.PageWrapper>
    )
}
