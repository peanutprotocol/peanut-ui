import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
}

export default function JobsPage() {
    return (
        <global_components.PageWrapper bgColor="bg-yellow">
            <components.Jobs />
        </global_components.PageWrapper>
    )
}
