'use client'

/*
 * Query-param stand-in for the web's `/<username>` public profile: the
 * [...recipient] catch-all is disabled in native builds (scripts/native-build.js),
 * so profileUrl() and the deep-link mapper route bare usernames here. Mirrors the
 * profile branch of src/app/[...recipient]/client.tsx.
 */
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import { ValidatedUsernameWrapper } from '@/components/Username/ValidatedUsernameWrapper'
import { useAuth } from '@/context/authContext'
import { sendUrl } from '@/utils/native-routes'

export default function ProfileViewPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [username] = useQueryState('username')

    useEffect(() => {
        if (!username) router.replace('/home')
    }, [username, router])

    if (!username) return null

    return (
        <ValidatedUsernameWrapper username={username}>
            <div className="mx-auto space-y-8 h-full w-full self-start">
                <PublicProfile
                    username={username}
                    isLoggedIn={!!user}
                    onSendClick={() => router.push(sendUrl(username))}
                />
            </div>
        </ValidatedUsernameWrapper>
    )
}
