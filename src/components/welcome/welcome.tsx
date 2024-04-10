'use client'
import * as global_components from '@/components/global'
import * as welcomePages from './components'
import { useEffect } from 'react'

export function welcomePage() {
    useEffect(() => {
        console.log(document.referrer)
    }, [])

    return (
        <global_components.PageWrapper>
            <welcomePages.Welcome />
        </global_components.PageWrapper>
    )
}
