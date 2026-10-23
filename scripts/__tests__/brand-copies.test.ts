import { readFileSync } from 'node:fs'
import path from 'node:path'

// The brand marks and the Knerd faces have one master each under src/. The
// press kit serves byte-identical copies under its public names; nothing may
// edit a copy on its own.
const PAIRS: Array<[master: string, copy: string]> = [
    ['src/assets/brand/logo.svg', 'public/press/assets/Peanut_Icon.svg'],
    ['src/assets/brand/wordmark.svg', 'public/press/assets/Peanut_Wordmark.svg'],
    ['src/assets/brand/logo-lockup.svg', 'public/press/assets/Peanut_Full_Logotype.svg'],
    ['src/assets/fonts/knerd-filled.ttf', 'public/press/assets/font/Fill.ttf'],
    ['src/assets/fonts/knerd-outline.ttf', 'public/press/assets/font/Outline.ttf'],
]

const root = path.resolve(__dirname, '..', '..')

describe('press-kit copies of the brand masters', () => {
    test.each(PAIRS)('%s is byte-identical to %s', (master, copy) => {
        // latin1 keeps every byte, so string equality is byte equality
        const same = readFileSync(path.join(root, master), 'latin1') === readFileSync(path.join(root, copy), 'latin1')
        expect(
            same ? '' : `${copy} differs from its master ${master}; copy the master over it, never edit the copy`
        ).toBe('')
    })
})
