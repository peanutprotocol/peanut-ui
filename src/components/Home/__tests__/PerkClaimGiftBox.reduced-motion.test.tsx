/**
 * the decorative gift loops must be motion-safe: gated so the OS
 * reduced-motion preference stops them (design.md law 4). the custom
 * keyframe classes are guarded in globals.css; the tailwind utility
 * loops here must carry the motion-safe: variant instead.
 */
import fs from 'fs'
import path from 'path'

const src = fs.readFileSync(path.join(__dirname, '..', 'PerkClaimGiftBox.tsx'), 'utf8')

describe('PerkClaimGiftBox reduced motion', () => {
    it('gates every tailwind animation utility behind motion-safe:', () => {
        const unguarded = src.match(/(?<!motion-safe:)animate-(bounce|ping|spin|pulse)/g)
        expect(unguarded).toBeNull()
    })
})
