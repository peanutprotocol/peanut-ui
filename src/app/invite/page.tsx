import InvitesPage from '@/components/Invites/InvitesPage'
import { BASE_URL } from '@/constants'
import getOrigin from '@/lib/hosting/get-origin'
import { Metadata } from 'next'
import { validateInviteCode } from '../actions/invites'

export const dynamic = 'force-dynamic'

async function getInviteCodeData(inviteCode: string) {
    if (!inviteCode) return null

    const response = await validateInviteCode(inviteCode)

    if (response.data?.success) {
        return {
            username: response.data.username,
        }
    }

    return null
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ id?: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
    const resolvedSearchParams = await searchParams
    const siteUrl: string = (await getOrigin()) || BASE_URL

    const inviteCode = resolvedSearchParams.code as string

    const inviteCodeData = await getInviteCodeData(inviteCode)

    let title = 'Invites | Peanut'

    // Generate OG image URL
    let ogImageUrl = '/metadata-img.png'

    let description = 'Invalid invite link'

    if (inviteCodeData) {
        title = `${inviteCodeData.username} invited you to join Peanut`
        description = 'Invite Page'

        const ogUrl = new URL(`${siteUrl}/api/og`)
        ogUrl.searchParams.set('isInvite', 'true')
        ogUrl.searchParams.set('username', inviteCodeData.username)

        if (!siteUrl) {
            console.error('Error: Unable to determine site origin')
        } else {
            ogImageUrl = ogUrl.toString()
        }
    }

    return {
        title,
        description,
        ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
        icons: {
            icon: '/favicon.ico',
        },
        openGraph: {
            title,
            description,
            images: [{ url: ogImageUrl, width: 1200, height: 630 }],
            type: 'website',
            siteName: 'Peanut',
        },
        twitter: {
            card: 'summary_large_image',
            site: '@PeanutProtocol',
            creator: '@PeanutProtocol',
            title,
            description,
            images: [
                {
                    url: ogImageUrl,
                },
            ],
        },
    }
}

export default function InvitePage() {
    return <InvitesPage />
}
