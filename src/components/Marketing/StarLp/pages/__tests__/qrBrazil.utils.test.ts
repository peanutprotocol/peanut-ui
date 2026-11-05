import { qrBrazilUsdFor } from '../qrBrazil.utils'

describe('qrBrazilUsdFor', () => {
    it('floors to the cent like the app amount field', () => {
        // 18 / 4.937 = 3.6459…: the Pay screen shows 3.64, not 3.65
        expect(qrBrazilUsdFor(18, 4.937)).toBe('3.64')
    })

    it('keeps two decimals on a whole result', () => {
        expect(qrBrazilUsdFor(18, 4.5)).toBe('4.00')
    })
})
