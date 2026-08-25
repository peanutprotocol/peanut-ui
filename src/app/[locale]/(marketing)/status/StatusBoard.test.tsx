import { render, screen } from '@testing-library/react'
import { StatusBoard } from './StatusBoard'
import { getTranslations } from '@/i18n'
import type { StatusProvider, StatusSummary } from './types'

const HOUR = 3600_000
const BASE = Date.parse('2026-08-25T00:00:00.000Z')

function provider(key: string, overrides: Partial<StatusProvider> = {}): StatusProvider {
    return {
        provider: key,
        state: 'operational',
        uptimePct: 100,
        buckets: Array.from({ length: 72 }, (_, hour) => ({
            hourStart: new Date(BASE + hour * HOUR).toISOString(),
            state: 'operational' as const,
            checks: 12,
            failures: 0,
        })),
        incidents: [],
        ...overrides,
    }
}

const KEYS = ['app', 'sumsub', 'manteca-ar', 'manteca-br', 'bridge', 'rhino', 'rpc', 'mobula', 'rain']

function summary(overrides: Partial<StatusSummary> = {}): StatusSummary {
    return {
        generatedAt: new Date(BASE).toISOString(),
        windowHours: 72,
        state: 'operational',
        providers: KEYS.map((key) => provider(key)),
        ...overrides,
    }
}

const i18n = getTranslations('en')

describe('StatusBoard', () => {
    it('renders one 72-hour bar row per service, in user-facing language', () => {
        render(<StatusBoard summary={summary()} locale="en" i18n={i18n} />)

        expect(screen.getByText('All systems operational')).toBeInTheDocument()
        expect(screen.getByText('Brazil (Pix / BRL)')).toBeInTheDocument()
        expect(screen.getByText('Peanut Card payments')).toBeInTheDocument()
        // Endpoint paths are what the old UptimeRobot page leaked; none here.
        expect(screen.queryByText(/api\/health/)).not.toBeInTheDocument()
        expect(screen.getAllByRole('img', { name: 'Last 72 hours' })).toHaveLength(KEYS.length)
    })

    it('shows an ongoing incident with its start time under the affected service', () => {
        const withIncident = summary({
            state: 'down',
            providers: KEYS.map((key) =>
                key === 'manteca-br'
                    ? provider(key, {
                          state: 'down',
                          uptimePct: 91.25,
                          incidents: [
                              {
                                  id: 'i1',
                                  startedAt: new Date(BASE + 70 * HOUR).toISOString(),
                                  resolvedAt: null,
                                  reason: 'provider_rejected' as const,
                              },
                          ],
                      })
                    : provider(key)
            ),
        })

        render(<StatusBoard summary={withIncident} locale="en" i18n={i18n} />)

        expect(screen.getByText('Service outage')).toBeInTheDocument()
        // The provider's own words never reach the page — a reader wondering
        // where their money is gets told what they lost and whether it is safe.
        expect(screen.queryByText(/Company blocked/)).not.toBeInTheDocument()
        expect(
            screen.getByText(/Deposits and withdrawals in Brazilian reais, including Pix, are unavailable/)
        ).toBeInTheDocument()
        expect(screen.getByText('The provider is refusing our requests.')).toBeInTheDocument()
        expect(screen.getByText('Ongoing')).toBeInTheDocument()
        expect(screen.getByText('91.25% uptime')).toBeInTheDocument()
    })

    it('marks a closed incident resolved and shows when it ended', () => {
        const resolved = summary({
            providers: KEYS.map((key) =>
                key === 'rhino'
                    ? provider(key, {
                          incidents: [
                              {
                                  id: 'i2',
                                  startedAt: new Date(BASE + 10 * HOUR).toISOString(),
                                  resolvedAt: new Date(BASE + 12 * HOUR).toISOString(),
                                  reason: 'timeout' as const,
                              },
                          ],
                      })
                    : provider(key)
            ),
        })

        render(<StatusBoard summary={resolved} locale="en" i18n={i18n} />)

        expect(screen.getByText('Resolved')).toBeInTheDocument()
        expect(screen.getByText(/→/)).toBeInTheDocument()
        expect(screen.getByText(/Withdrawals to other blockchain networks are unavailable/)).toBeInTheDocument()
    })

    it('renders incident times in UTC, and says so', () => {
        const withIncident = summary({
            providers: KEYS.map((key) =>
                key === 'rain'
                    ? provider(key, {
                          incidents: [
                              {
                                  id: 'i3',
                                  // 14:05 UTC — a host in UTC-5 would print 09:05.
                                  startedAt: '2026-08-25T14:05:00.000Z',
                                  resolvedAt: null,
                                  reason: 'provider_error' as const,
                              },
                          ],
                      })
                    : provider(key)
            ),
        })

        render(<StatusBoard summary={withIncident} locale="en" i18n={i18n} />)

        expect(screen.getByText(/Aug 25, 02:05 PM/)).toBeInTheDocument()
        expect(screen.getByText('Times shown in UTC')).toBeInTheDocument()
    })
})
