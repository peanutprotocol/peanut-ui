export type UserSort = 'updated' | 'created' | 'username'

export interface UserListItem {
    user_id: string
    username: string | null
    full_name: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    created_at: string
    updated_at: string | null
    is_active: boolean | null
    residence_country: string | null
    kyc_status: string | null
}

export interface UserListPage {
    users: UserListItem[]
    next: string | null
}

export interface UserRecordStats {
    users: number
    signups_7d: number
    kyc_approved: number
}

export type RecordRow = Record<string, unknown>

export interface RecordSection {
    table: string
    depth: number
    links: { column: string; fromTable: string; fromColumn: string }[]
    columns: string[]
    rows: RecordRow[]
    total: number
    limit: number
    error?: string
}

export interface UserRecord {
    user: { columns: string[]; row: RecordRow }
    sections: RecordSection[]
    schema: string
    generatedAt: string
}
