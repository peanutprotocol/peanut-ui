import fs from 'fs'
import path from 'path'
import { RESIDENCE_STICKERS, RESIDENCE_STICKER_DIR, residenceStickerSrc } from '../residence-stickers.consts'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const COUNTRIES = 'AR BR US ES PY MX PT DE CO PH FR NG PE ID IT AO UY CL BO VE'.split(' ')

describe('residence stickers', () => {
    it('covers exactly the 20 approved countries', () => {
        expect(Object.keys(RESIDENCE_STICKERS).sort()).toEqual([...COUNTRIES].sort())
    })

    it.each(Object.entries(RESIDENCE_STICKERS))(
        '%s has three stickers of its own, each a file on disk',
        (code, files) => {
            expect(files).toHaveLength(3)
            expect(new Set(files).size).toBe(3)
            for (const file of files) {
                expect(file).toMatch(new RegExp(`^${code.toLowerCase()}-[a-z]+\\.webp$`))
                expect(fs.existsSync(path.join(PUBLIC_DIR, residenceStickerSrc(file)))).toBe(true)
            }
        }
    )

    it('ships no sticker file the map does not use', () => {
        const listed = Object.values(RESIDENCE_STICKERS).flat().sort()
        expect(fs.readdirSync(path.join(PUBLIC_DIR, RESIDENCE_STICKER_DIR)).sort()).toEqual(listed)
    })
})
