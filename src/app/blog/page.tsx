'use client'
import * as global_components from '@/components/global'
import * as components from '@/components'

export default function BlogPage() {
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Blog />
        </global_components.PageWrapper>
    )
}
