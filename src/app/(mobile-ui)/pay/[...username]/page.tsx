'use client'

import { useRouter } from 'next/navigation'
import { use } from 'react'
import { sendUrl } from '@/utils/native-routes'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function DirectPaymentPage(props: PageProps) {
    const router = useRouter()
    const params = use(props.params)
    const usernameSegments = params.username ?? []

    const recipient = usernameSegments

    if (recipient[0]) {
        router.push(sendUrl(recipient[0]))
    } else {
        router.push('/send')
    }

    return null
}
