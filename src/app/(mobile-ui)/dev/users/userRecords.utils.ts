import type { RecordSection, UserListItem, UserSort } from './userRecords.types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

// Short labels: the three tabs share the list column, about 300px wide.
export const SORT_OPTIONS: { value: UserSort; label: string }[] = [
    { value: 'updated', label: 'Updated' },
    { value: 'created', label: 'Signed up' },
    { value: 'username', label: 'A–Z' },
]

// The page shows whatever database its API reads, so staging shows staging users.
export function databaseDescription(environment: string): string {
    if (environment === 'production') return 'the production database'
    if (environment === 'staging') return 'the staging database'
    return "this environment's database"
}

export function isIsoDate(value: unknown): boolean {
    return typeof value === 'string' && ISO_DATE.test(value)
}

/** UTC on purpose: the database stores UTC, and two teammates must read the same time. */
export function formatUtc(iso: string | null | undefined, withTime = true): string {
    if (!iso) return '—'
    const text = new Date(iso).toISOString()
    return withTime ? `${text.slice(0, 10)} ${text.slice(11, 16)} UTC` : text.slice(0, 10)
}

type NameFields = Partial<Pick<UserListItem, 'full_name' | 'first_name' | 'last_name' | 'username' | 'email'>> & {
    user_id: string
}

export function displayName(user: NameFields): string {
    return (
        user.full_name ||
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.username ||
        user.email ||
        user.user_id
    )
}

/** The date a list row shows follows the sort, so "recently updated" shows when. */
export function listDate(user: UserListItem, sort: UserSort): string {
    return sort === 'updated'
        ? `Updated ${formatUtc(user.updated_at ?? user.created_at, false)}`
        : `Joined ${formatUtc(user.created_at, false)}`
}

const LEADING_COLUMNS = ['created_at', 'kind', 'type', 'status', 'provider', 'requested_amount', 'amount']

/** Puts the columns people scan for first; every column still shows. */
export function tableColumns(columns: string[]): string[] {
    const leading = LEADING_COLUMNS.filter((column) => columns.includes(column))
    return [...leading, ...columns.filter((column) => !leading.includes(column))]
}

export function linkDescription(section: RecordSection): string {
    return section.links
        .map((link) =>
            link.fromTable === 'users' ? link.column : `${link.column} → ${link.fromTable}.${link.fromColumn}`
        )
        .join(', ')
}

export function rowCountLabel(section: RecordSection): string {
    const format = new Intl.NumberFormat('en-US')
    if (section.total > section.rows.length) {
        return `${format.format(section.rows.length)} of ${format.format(section.total)} rows, newest first`
    }
    return `${format.format(section.total)} ${section.total === 1 ? 'row' : 'rows'}`
}

/** Latest KYC status: the newest verification not yet superseded, else the newest. */
export function latestKycStatus(sections: RecordSection[]): string | null {
    const rows = sections.find((section) => section.table === 'user_kyc_verifications')?.rows ?? []
    const current = rows.find((row) => !row.superseded_at) ?? rows[0]
    return typeof current?.status === 'string' ? current.status : null
}

export function sumsubApplicantIds(sections: RecordSection[]): string[] {
    const rows = sections.find((section) => section.table === 'user_kyc_verifications')?.rows ?? []
    return [
        ...new Set(
            rows.map((row) => row.sumsub_applicant_id).filter((id): id is string => typeof id === 'string' && !!id)
        ),
    ]
}

export function sectionAnchor(table: string): string {
    return `records-${table}`
}
