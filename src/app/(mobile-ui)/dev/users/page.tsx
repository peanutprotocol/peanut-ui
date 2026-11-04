'use client'

/**
 * Dev page: everything the API's database stores about one user, read-only.
 *
 * Team only. The API (/admin/users) checks the signed-in account against its
 * team list; anyone else gets a 403 and sees no data. Search, sort and the
 * open user live in the URL, so a link to a user can be shared with the team.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { suppressPrivateRouteTelemetry } from '@/utils/private-route-telemetry'
import { inferSentryEnvironment } from '@/utils/sentry-env'
import { twMerge } from '@/utils/tw'
import DevPageShell from '../_components/DevPageShell'
import UserList from './_components/UserList'
import UserRecordView from './_components/UserRecordView'
import { fetchUserRecordStats } from './userRecords.api'
import type { UserSort } from './userRecords.types'
import { databaseDescription, SORT_OPTIONS } from './userRecords.utils'

const SEARCH_DEBOUNCE_MS = 300
const numberFormat = new Intl.NumberFormat('en-US')

export default function UserRecordsPage() {
    // During render, before any customer data is fetched or drawn: no replay, analytics or error reports here.
    suppressPrivateRouteTelemetry()
    const [{ q, sort, user }, setParams] = useQueryStates({
        q: parseAsString.withDefault(''),
        sort: parseAsStringEnum<UserSort>(['updated', 'created', 'username']).withDefault('updated'),
        user: parseAsString,
    })
    const [draft, setDraft] = useState(q)

    useEffect(() => {
        const timer = setTimeout(() => {
            if (draft.trim() !== q) void setParams({ q: draft.trim() || null })
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [draft, q, setParams])

    const stats = useQuery({ queryKey: ['dev-user-records', 'stats'], queryFn: fetchUserRecordStats, retry: false })

    return (
        <DevPageShell
            title="User records"
            description={`Everything ${databaseDescription(inferSentryEnvironment())} stores about a user. Read-only, team only, and every view is logged.`}
            actions={
                stats.data && (
                    <dl className="flex gap-6 text-body-xs">
                        {[
                            ['Users', stats.data.users],
                            ['Sign-ups, 7 days', stats.data.signups_7d],
                            ['KYC approved', stats.data.kyc_approved],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-foreground-secondary">{label}</dt>
                                <dd className="text-body-s-semibold tabular-nums">
                                    {numberFormat.format(Number(value))}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )
            }
        >
            <div className="grid w-full items-start gap-6 md:grid-cols-[minmax(18rem,24rem)_1fr]">
                <aside
                    className={twMerge(
                        CARD_SURFACE,
                        // On a phone the record renders under the list: cap the list so a selection is in view.
                        'flex max-h-[45dvh] flex-col overflow-hidden md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)]'
                    )}
                >
                    <div className="flex flex-col gap-3 border-b border-border-default p-4">
                        <BaseInput
                            type="search"
                            size="sm"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Name, surname, username, email, ID or wallet"
                            aria-label="Search users"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <Tabs
                            aria-label="Sort users"
                            size="sm"
                            fullWidth="stretch"
                            value={sort}
                            onValueChange={(value) => void setParams({ sort: value as UserSort })}
                            tabs={SORT_OPTIONS}
                        />
                    </div>
                    <div className="min-h-0 overflow-y-auto">
                        <UserList
                            query={q}
                            sort={sort}
                            selectedId={user}
                            onSelect={(id) => void setParams({ user: id })}
                        />
                    </div>
                </aside>

                {user ? (
                    <UserRecordView key={user} userId={user} />
                ) : (
                    <EmptyState
                        icon="user"
                        title="Select a user"
                        description="Search on the left, then pick a user to see their record."
                    />
                )}
            </div>
        </DevPageShell>
    )
}
