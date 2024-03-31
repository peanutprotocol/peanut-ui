'use client'
import * as global_components from '@/components/global'
import * as welcomePages from './components'

export function welcomePage() {
    return (
        <global_components.PageWrapper>
            <welcomePages.Welcome />
        </global_components.PageWrapper>
    )
}
