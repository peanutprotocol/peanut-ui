import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { resolveGoRedirect } from '@/features/go-links/go-map'

// No loading.tsx or Suspense above the redirect: either would turn the 307 and 404 answers into soft 200s.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** peanut.me/go/<key>: a 307 to the key's path in GO_REDIRECTS, or a 404. The incoming query is dropped. */
export default async function GoPage({ params }: { params: Promise<{ key: string[] }> }) {
    const destination = resolveGoRedirect((await params).key)
    if (!destination) notFound()
    redirect(destination)
}
