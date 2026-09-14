'use client'

import ProfileMenuItem from '@/components/Profile/components/ProfileMenuItem'
import DevPageShell from '../_components/DevPageShell'

export default function ProfileCardRowPreviewPage() {
    return (
        <DevPageShell
            title="Profile card row"
            description="The public card entry uses the same label and destination for every account."
            width="prose"
        >
            <ProfileMenuItem icon="credit-card" label="Peanut Card" href="/card" position="single" />
        </DevPageShell>
    )
}
