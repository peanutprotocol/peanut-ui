import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
}

export default function Milkomeda() {
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Milkomeda />
        </global_components.PageWrapper>
    )
}
