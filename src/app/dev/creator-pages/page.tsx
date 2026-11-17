import Link from 'next/link'
import { CREATOR_PAGE_EXPERIMENTS } from '@/features/creator-pages/experiments'

/** Index of every creator page variant. `/dev/*` does not answer on peanut.me (src/proxy.ts). */
export default function CreatorPagesIndex() {
    return (
        <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
            <h1 className="text-heading-s">Creator pages</h1>
            <p className="text-body-m text-foreground-secondary">
                Previews render from a fixture. They send no events and set no cookie.
            </p>
            {Object.entries(CREATOR_PAGE_EXPERIMENTS).map(([username, experiment]) => {
                const total = experiment.variants.reduce((sum, variant) => sum + variant.weight, 0)
                return (
                    <section key={username} className="flex flex-col gap-2">
                        <h2 className="text-heading-xs">
                            {username} · {experiment.id}
                        </h2>
                        <ul className="flex flex-col gap-1">
                            {experiment.variants.map((variant) => (
                                <li key={variant.id}>
                                    <Link className="underline" href={`/dev/creator-pages/${username}/${variant.id}`}>
                                        {variant.id}
                                    </Link>{' '}
                                    {total > 0 ? `${Math.round((variant.weight / total) * 100)}%` : 'parked'}
                                </li>
                            ))}
                        </ul>
                    </section>
                )
            })}
        </main>
    )
}
