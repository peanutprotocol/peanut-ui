import { type Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Creator Contest',
    description: 'The Peanut content contest for creators in Brazil.',
    robots: { index: false, follow: false },
}

export default function CreatorContestPage() {
    return (
        <main className="h-[100dvh] w-full bg-white">
            <iframe
                src="https://peanut-contest.vercel.app/"
                title="Peanut Creator Contest"
                className="h-full w-full border-0"
                sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-storage-access-by-user-activation"
                referrerPolicy="strict-origin-when-cross-origin"
            />
        </main>
    )
}
