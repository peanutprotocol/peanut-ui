/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SPLIT_BRANCH = 'fix/split-b2-raw-path-seam'
const SPLIT_CONDITION = `github.head_ref == '${SPLIT_BRANCH}'`
const DEFAULT_CONDITION = `github.head_ref != '${SPLIT_BRANCH}'`
const ORIGIN_BINDING = 'SPLIT_CONTENT_ORIGIN: ${{ vars.SPLIT_CONTENT_ORIGIN }}'
const MARKER_BINDING = 'SPLIT_CONTENT_EDGE_MARKER: ${{ secrets.SPLIT_CONTENT_EDGE_MARKER }}'

describe('Preview workflow Split canary contract', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/preview.yaml'), 'utf8')
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')

    function namedStep(name: string): string {
        const marker = `            - name: ${name}\n`
        const start = workflow.indexOf(marker)
        if (start < 0) throw new Error(`Missing Preview workflow step: ${name}`)

        const nextStep = workflow.indexOf('\n            - ', start + marker.length)
        return workflow.slice(start, nextStep < 0 ? undefined : nextStep)
    }

    it('fails closed on the canary branch when either repository setting is absent', () => {
        const validation = namedStep('Validate Split canary Preview configuration')

        expect(validation).toContain(`if: ${SPLIT_CONDITION}`)
        expect(validation).toContain(ORIGIN_BINDING)
        expect(validation).toContain(MARKER_BINDING)
        expect(validation).toContain('if [[ -z "$SPLIT_CONTENT_ORIGIN" ]]')
        expect(validation).toContain('if [[ -z "$SPLIT_CONTENT_EDGE_MARKER" ]]')
        expect(validation).not.toMatch(/echo[^\n]*\$SPLIT_CONTENT_(?:ORIGIN|EDGE_MARKER)/)
    })

    it('keeps the default build and deploy commands unchanged for every other branch', () => {
        const build = namedStep('Build Project Artifacts')
        expect(build).toContain(`if: ${DEFAULT_CONDITION}`)
        expect(build).toContain('run: vercel build --target=preview --token=${{ secrets.VERCEL_TOKEN }}')

        const deploy = namedStep('Deploy Project Artifacts to Vercel')
        expect(deploy).toContain(`if: ${DEFAULT_CONDITION}`)
        expect(deploy).toContain(
            'run: vercel deploy --prebuilt --archive=tgz --target=preview --scope=squirrellabs --token=${{ secrets.VERCEL_TOKEN }}'
        )
    })

    it('passes both settings to the canary build environment and deployment runtime', () => {
        const build = namedStep('Build Project Artifacts (Split canary)')
        expect(build).toContain(`if: ${SPLIT_CONDITION}`)
        expect(build).toContain(ORIGIN_BINDING)
        expect(build).toContain(MARKER_BINDING)
        expect(build).toContain('run: vercel build --target=preview --token=${{ secrets.VERCEL_TOKEN }}')

        const deploy = namedStep('Deploy Project Artifacts to Vercel (Split canary)')
        expect(deploy).toContain(`if: ${SPLIT_CONDITION}`)
        expect(deploy).toContain(ORIGIN_BINDING)
        expect(deploy).toContain(MARKER_BINDING)
        expect(deploy).toContain('--prebuilt')
        expect(deploy).toContain('--target=preview')
        expect(deploy).toContain('--env SPLIT_CONTENT_ORIGIN="$SPLIT_CONTENT_ORIGIN"')
        expect(deploy).toContain('--env SPLIT_CONTENT_EDGE_MARKER="$SPLIT_CONTENT_EDGE_MARKER"')
    })

    it('does not expose Split settings to any unrelated Preview step', () => {
        expect(workflow.split(ORIGIN_BINDING)).toHaveLength(4)
        expect(workflow.split(MARKER_BINDING)).toHaveLength(4)
    })

    it('documents both server-only settings without shipping placeholder values', () => {
        expect(envExample).toMatch(/^export SPLIT_CONTENT_ORIGIN=$/m)
        expect(envExample).toMatch(/^export SPLIT_CONTENT_EDGE_MARKER=$/m)
        expect(envExample).toContain('Setting only one makes Split-owned paths fail closed with 503.')
        expect(envExample).toContain('Keep the marker server-only')
    })
})
