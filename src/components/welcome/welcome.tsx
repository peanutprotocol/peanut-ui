'use client'
import * as global_components from '@/components/global'
import * as welcomePages from './components'

export function welcomePage() {
    // const isMantleUrl = utils.isMantleInUrl()

    return (
        <global_components.PageWrapper>
            <welcomePages.Welcome />{' '}
        </global_components.PageWrapper>
    )
}
