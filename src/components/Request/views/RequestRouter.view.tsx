'use client'
import { useRouter } from 'next/navigation'

export const RequestRouterView = () => {
    const router = useRouter()

    // this is going to be deprecated in request pots
    return <div>request router view</div>
}
