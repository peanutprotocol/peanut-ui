import { COUNTRY_SPECIFIC_METHODS } from '@/components/AddMoney/consts'
import { isPixPagePath, pixDepositCodeUrl } from '../pix.routes'

describe('the neutral Pix pages', () => {
    it("are where Brazil's add-money and own-account withdraw rows go", () => {
        const add = COUNTRY_SPECIFIC_METHODS.BR.add
        expect(add.find((method) => method.id === 'pix-add')?.path).toBe('/add-money/pix')
        expect(add.find((method) => method.id === 'bank-transfer-add')?.path).toBe('/add-money/pix')
        const withdraw = COUNTRY_SPECIFIC_METHODS.BR.withdraw
        expect(withdraw.find((method) => method.id === 'br-default-bank-withdraw')?.path).toBe('/withdraw/pix')
        // a Pix-key send to anyone stays on the QR-pay key screen
        expect(withdraw.some((method) => method.path === '/withdraw/manteca?method=pix&country=brazil')).toBe(true)
        // Argentina keeps its Manteca pages
        expect(COUNTRY_SPECIFIC_METHODS.AR.add.find((method) => method.id === 'bank-transfer-add')?.path).toBe(
            '/add-money/argentina/manteca'
        )
    })

    it('are recognised as pages that run their own flow', () => {
        expect(isPixPagePath('/withdraw/pix?step=amount')).toBe(true)
        expect(isPixPagePath(pixDepositCodeUrl('d1'))).toBe(true)
        expect(isPixPagePath('/withdraw/manteca?country=argentina')).toBe(false)
        expect(isPixPagePath(undefined)).toBe(false)
    })
})
