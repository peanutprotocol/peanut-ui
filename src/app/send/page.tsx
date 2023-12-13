import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
}

export default function SendPage() {
    return (
        <global_components.PageWrapper>
            <components.Send />
        </global_components.PageWrapper>
    )
}
