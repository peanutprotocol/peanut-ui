import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
}

export default function DashboardPage() {
    return (
        <global_components.PageWrapper>
            <components.Dashboard />
        </global_components.PageWrapper>
    )
}
