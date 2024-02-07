import * as _consts from './gigaPacket.consts'

export function divideAndRemainder(value: number): [number, number] {
    const quotient = Math.floor(value / _consts.MAX_TRANSACTIONS_PER_BLOCK)
    const remainder = value % _consts.MAX_TRANSACTIONS_PER_BLOCK
    return [quotient, remainder]
}
