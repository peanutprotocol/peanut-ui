import { brlOperationsServedBy, getLimitColorClass, mantecaBrlLimitApplies } from '../utils'

describe('limit attention colors', () => {
    test.each([21, 50, 70])('%s percent remaining uses a readable attention foreground', (remaining) => {
        expect(getLimitColorClass(remaining, 'text')).toBe('text-foreground-attention')
    })
    test.each([21, 50, 70])('%s percent remaining keeps the yellow progress fill', (remaining) => {
        expect(getLimitColorClass(remaining, 'bg')).toBe('bg-background-accent-yellow')
    })
})

// review 2, finding 5: inside Avenia's Pix gate and outside its QR gate, Manteca still serves the QR payment
describe('whose BRL limits apply, per operation', () => {
    const route = (operation: string, provider: string) => ({ operation, method: 'PIX_BR', provider, state: 'ready' })
    const pixGateOnly = [route('deposit', 'avenia'), route('withdraw', 'avenia'), route('pay', 'manteca')]

    it('names the operations each provider serves from their own routes', () => {
        expect(brlOperationsServedBy(pixGateOnly as never, 'avenia')).toEqual(['deposit', 'withdraw'])
        expect(brlOperationsServedBy(pixGateOnly as never, 'manteca')).toEqual(['pay'])
    })

    it.each([
        ['Manteca still serves the QR payment', pixGateOnly, true],
        ['every Pix route names Avenia', ['deposit', 'withdraw', 'pay'].map((op) => route(op, 'avenia')), false],
        ['every Pix route names Manteca', ['deposit', 'withdraw', 'pay'].map((op) => route(op, 'manteca')), true],
        ['no Pix route is known', [], true],
    ])('Manteca’s BRL limit applies when %s: %s', (_label, routes, applies) => {
        expect(mantecaBrlLimitApplies(routes as never)).toBe(applies)
    })
})
