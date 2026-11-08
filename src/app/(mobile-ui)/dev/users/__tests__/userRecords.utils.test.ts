import type { RecordSection, UserListItem } from '../userRecords.types'
import {
    databaseDescription,
    displayName,
    formatUtc,
    latestKycStatus,
    listDate,
    rowCountLabel,
    sumsubApplicantIds,
    tableColumns,
} from '../userRecords.utils'

const user: UserListItem = {
    user_id: 'u1',
    username: 'ana',
    full_name: null,
    first_name: 'Ana',
    last_name: 'Lopez',
    email: 'ana@example.test',
    created_at: '2026-09-16T08:46:00.000Z',
    updated_at: '2026-10-25T23:59:00.000Z',
    is_active: true,
    residence_country: 'DE',
    kyc_status: null,
}

const kycSection = (rows: RecordSection['rows']): RecordSection => ({
    table: 'user_kyc_verifications',
    depth: 1,
    links: [{ column: 'user_id', fromTable: 'users', fromColumn: 'user_id' }],
    columns: ['status', 'superseded_at', 'sumsub_applicant_id'],
    rows,
    total: rows.length,
    limit: 200,
})

describe('user records utils', () => {
    it('names a user by full name, then first + last name, then username', () => {
        expect(displayName({ ...user, full_name: 'Ana María Lopez' })).toBe('Ana María Lopez')
        expect(displayName(user)).toBe('Ana Lopez')
        expect(displayName({ ...user, first_name: null, last_name: null })).toBe('ana')
        expect(displayName({ ...user, first_name: null, last_name: null, username: null, email: null })).toBe('u1')
    })

    it('shows the date the list is sorted by, in UTC', () => {
        expect(listDate(user, 'updated')).toBe('Updated 2026-10-25')
        expect(listDate(user, 'created')).toBe('Joined 2026-09-16')
        expect(listDate(user, 'username')).toBe('Joined 2026-09-16')
        expect(listDate({ ...user, updated_at: null }, 'updated')).toBe('Updated 2026-09-16')
        expect(formatUtc('2026-10-25T23:59:00.000Z')).toBe('2026-10-25 23:59 UTC')
        expect(formatUtc(null)).toBe('—')
    })

    it('leads tables with the columns people scan, and keeps every column', () => {
        expect(tableColumns(['id', 'user_id', 'status', 'kind', 'created_at', 'metadata'])).toEqual([
            'created_at',
            'kind',
            'status',
            'id',
            'user_id',
            'metadata',
        ])
    })

    it('says when a table shows only its newest rows', () => {
        expect(rowCountLabel({ ...kycSection([{}, {}]), total: 1234 })).toBe('2 of 1,234 rows, newest first')
        expect(rowCountLabel(kycSection([{}]))).toBe('1 row')
    })

    it('reads the current KYC status and the Sumsub applicants', () => {
        const sections = [
            kycSection([
                { status: 'REJECTED', superseded_at: '2026-01-01T00:00:00.000Z', sumsub_applicant_id: 'a1' },
                { status: 'APPROVED', superseded_at: null, sumsub_applicant_id: 'a1' },
                { status: 'PENDING', superseded_at: null, sumsub_applicant_id: 'a2' },
            ]),
        ]
        expect(latestKycStatus(sections)).toBe('APPROVED')
        expect(sumsubApplicantIds(sections)).toEqual(['a1', 'a2'])
        expect(latestKycStatus([])).toBeNull()
    })
})

describe('databaseDescription', () => {
    it('names the database the page reads in each environment', () => {
        expect(databaseDescription('production')).toBe('the production database')
        expect(databaseDescription('staging')).toBe('the staging database')
        expect(databaseDescription('preview')).toBe("this environment's database")
        expect(databaseDescription('native')).toBe("this environment's database")
    })
})
