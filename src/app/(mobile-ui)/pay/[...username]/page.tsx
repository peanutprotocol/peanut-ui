'use client'

import { useRouter } from 'next/navigation'
import { use } from 'react'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function DirectPaymentPage(props: PageProps) {
    const router = useRouter()
    const params = use(props.params)
    const usernameSegments = params.username ?? []

    const recipient = usernameSegments

    router.push(`/send/${recipient[0]}`)

    return null
}
