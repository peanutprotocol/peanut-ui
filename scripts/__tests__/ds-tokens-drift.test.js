const { execFileSync } = require('child_process')
const path = require('path')

// the /dev/ds foundations pages render tokens.generated.ts, which is emitted
// from the @theme block in globals.css. this test fails CI whenever the theme
// changes without a regen — the whole point of DS 12 is that the docs cannot
// drift from the token source (the hand-typed colors doc had 6/12 swatches
// wrong). fix: `pnpm gen:ds-tokens` and commit.
describe('ds tokens drift', () => {
    it('tokens.generated.ts matches the @theme block in globals.css', () => {
        const script = path.join(__dirname, '..', 'generate-ds-tokens.mjs')
        execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })
    })
})
