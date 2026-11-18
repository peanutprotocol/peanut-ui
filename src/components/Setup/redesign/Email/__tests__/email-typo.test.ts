import { suggestEmailFix } from '../email-typo'

describe('suggestEmailFix', () => {
    it.each([
        ['maria@gmial.com', 'maria@gmail.com'],
        ['maria@gmai.com', 'maria@gmail.com'],
        ['maria@gmaill.com', 'maria@gmail.com'],
        ['maria@hotmial.com', 'maria@hotmail.com'],
        ['maria@outlok.com', 'maria@outlook.com'],
        ['maria@yaho.com', 'maria@yahoo.com'],
        ['maria@iclod.com', 'maria@icloud.com'],
        ['maria@gmail.con', 'maria@gmail.com'],
        ['maria@live.cmo', 'maria@live.com'],
        ['maria@gmial.con', 'maria@gmail.com'],
        ['maria@company.con', 'maria@company.com'],
        ['Maria.Silva@GMIAL.com', 'Maria.Silva@gmail.com'],
        ['  maria@gmial.com  ', 'maria@gmail.com'],
    ])('fixes %s to %s', (input, expected) => {
        expect(suggestEmailFix(input)).toBe(expected)
    })

    it.each([
        'maria@gmail.com',
        'maria@Gmail.com',
        'maria@live.com',
        'maria@hotmail.com.ar',
        'maria@yahoo.com.br',
        'maria@company.com',
        // real providers one edit away from a common one
        'maria@mail.com',
        'maria@ymail.com',
        'maria@email.com',
        // "live" is too short to guess at
        'maria@lve.com',
        'maria',
        '@gmial.com',
        'maria@gmial',
        'maria@gmial..com',
    ])('leaves %s alone', (input) => {
        expect(suggestEmailFix(input)).toBeNull()
    })
})
