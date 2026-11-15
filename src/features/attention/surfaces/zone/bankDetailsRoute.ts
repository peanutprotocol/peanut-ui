import { createSerializer, parseAsStringLiteral } from 'nuqs/server'

const serialize = createSerializer({ method: parseAsStringLiteral(['bank'] as const) })
export const bankDetailsHref = () => serialize('/add-money', { method: 'bank' })
