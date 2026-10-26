'use client'

import { useQuery } from '@tanstack/react-query'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { twMerge } from '@/utils/tw'
import { fetchUserRecord } from '../userRecords.api'
import { displayName, formatUtc, latestKycStatus, sectionAnchor, sumsubApplicantIds } from '../userRecords.utils'
import KycBadge from './KycBadge'
import RecordFields from './RecordFields'
import RecordSectionCard from './RecordSectionCard'

const POSTHOG_PERSON_URL = 'https://eu.posthog.com/project/138913/person/'
const SUMSUB_APPLICANT_URL = 'https://cockpit.sumsub.com/checkus#/applicant/'

function jumpTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function UserRecordView({ userId }: { userId: string }) {
    const record = useQuery({
        queryKey: ['dev-user-records', 'user', userId],
        queryFn: () => fetchUserRecord(userId),
        retry: false,
    })

    if (record.isError) return <Callout priority="error">{record.error.message}</Callout>
    if (record.isPending) return <p className="text-body-s text-foreground-secondary">Loading user…</p>

    const { user, sections, schema, generatedAt } = record.data
    const row = user.row as Record<string, string | null> & { user_id: string }
    const filled = sections.filter((section) => section.total > 0 || section.error)
    const empty = sections.filter((section) => section.total === 0 && !section.error)

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-heading-card">{displayName(row)}</h2>
                    <KycBadge status={latestKycStatus(sections)} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-s">
                    {row.username && <span>@{row.username}</span>}
                    {row.email && <span>{row.email}</span>}
                    <span className="font-mono text-body-xs">{row.user_id}</span>
                    <span className="text-foreground-secondary">Joined {formatUtc(row.created_at)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 text-body-s-semibold">
                    <a
                        className="underline"
                        href={`${POSTHOG_PERSON_URL}${encodeURIComponent(row.user_id)}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        PostHog person
                    </a>
                    {sumsubApplicantIds(sections).map((id) => (
                        <a
                            key={id}
                            className="underline"
                            href={`${SUMSUB_APPLICANT_URL}${encodeURIComponent(id)}/basicInfo`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Sumsub applicant
                        </a>
                    ))}
                </div>
                <p className="text-body-xs text-foreground-secondary">
                    Read-only snapshot of {schema}.* at {formatUtc(generatedAt)}. Secrets are hidden.
                </p>
            </header>

            <nav aria-label="Tables" className="flex gap-2 overflow-x-auto py-1">
                {[{ table: 'users', total: user.columns.length, error: undefined }, ...filled].map((section) => (
                    <button
                        key={section.table}
                        type="button"
                        onClick={() => jumpTo(sectionAnchor(section.table))}
                        className="shrink-0 rounded-full border border-border-default bg-background-default px-3 py-1 font-mono text-body-xs whitespace-nowrap"
                    >
                        {section.table}{' '}
                        <span className="text-foreground-secondary">{section.error ? '!' : section.total}</span>
                    </button>
                ))}
            </nav>

            <section id={sectionAnchor('users')} className={twMerge(CARD_SURFACE, 'scroll-mt-20 overflow-hidden')}>
                <header className="flex items-baseline gap-3 border-b border-border-default px-4 py-3">
                    <h2 className="font-mono text-body-s-semibold">users</h2>
                    <span className="text-body-xs text-foreground-secondary">{user.columns.length} fields</span>
                </header>
                <RecordFields columns={user.columns} row={user.row} />
            </section>

            {filled.map((section) => (
                <RecordSectionCard key={section.table} section={section} />
            ))}

            {empty.length > 0 && (
                <p className="text-body-xs text-foreground-secondary">
                    No rows in {empty.length} linked tables:{' '}
                    <span className="font-mono">{empty.map((s) => s.table).join(', ')}</span>
                </p>
            )}
        </div>
    )
}
