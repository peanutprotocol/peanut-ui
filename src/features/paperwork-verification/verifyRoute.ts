import { createSerializer, parseAsBoolean } from 'nuqs/server'

const serialize = createSerializer({ skipOverview: parseAsBoolean })

/** /verify past its steps overview, for a caller that already listed the steps (the sign-up Verify start). */
export const verifySkipOverviewHref = () => serialize('/verify', { skipOverview: true })
