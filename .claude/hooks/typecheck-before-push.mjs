#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): before a `git push` from this repo, run `npm run typecheck` and
// block the push on type errors. CI runs the same check; this finds the error before the push does
// (mono CONTRIBUTING: typecheck before you push). Exit 2 blocks the command and shows stderr to the agent.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8'))
const command = input.tool_input?.command ?? ''
if (!/\bgit\b[^;&|]*\bpush\b/.test(command) || /\s(--delete|-d|--tags)\b/.test(command)) process.exit(0)

// The push runs where the command says: `git -C <dir>` or a leading `cd <dir> &&`, else in the session's cwd.
const unquote = (s) => s.replace(/^["']|["']$/g, '')
const target =
    command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1] ??
    command.match(/(?:^|&&|;)\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)?.[1]
const dir = target ? resolve(input.cwd, unquote(target)) : input.cwd

let top
try {
    top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
} catch {
    process.exit(0) // not a git checkout: nothing to check
}
const pkg = resolve(top, 'package.json')
if (!existsSync(pkg) || !JSON.parse(readFileSync(pkg, 'utf8')).scripts?.typecheck) process.exit(0)
if (!existsSync(resolve(top, 'node_modules'))) {
    console.error(`typecheck-before-push: ${top} has no node_modules, so the typecheck was skipped; CI still runs it.`)
    process.exit(0)
}

// The typecheck reads the checked-out tree, so it can only vouch for a push of that tree:
// `git push [remote] [src[:dst]]` with src left out, HEAD, or the branch checked out here.
// A push of another branch, or a delete (`:dst`), is left to CI.
const pushArgs = command
    .slice(command.search(/\bpush\b/) + 4)
    .split(/&&|;|\|/)[0]
    .split(/\s+/)
    .filter((arg) => arg && !arg.startsWith('-'))
const refspec = (pushArgs[1] ?? 'HEAD').replace(/^\+/, '')
if (refspec.startsWith(':')) process.exit(0)
const commitOf = (ref) => {
    try {
        return execFileSync('git', ['-C', top, 'rev-parse', '--verify', '-q', `${ref}^{commit}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
    } catch {
        return null
    }
}
const source = refspec.split(':')[0]
if (source !== 'HEAD' && commitOf(source) !== commitOf('HEAD')) {
    console.error(
        `typecheck-before-push: this push sends ${source}, not the checked-out tree, so it was not typechecked here; CI still runs it.`
    )
    process.exit(0)
}

// Only pushes that change types pay for the typecheck: api's runs tsc twice with 6 GB each. The range is the
// commits not yet on the upstream (or on origin/dev for a new branch); if git cannot tell, check anyway.
const changed = (range) => {
    try {
        return execFileSync('git', ['-C', top, 'diff', '--name-only', range], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        })
    } catch {
        return null
    }
}
const files = changed('@{upstream}...HEAD') ?? changed('origin/dev...HEAD')
if (
    files !== null &&
    !files.split('\n').some((f) => /\.(ts|tsx|mts|cts)$|(^|\/)(tsconfig[^/]*\.json|package\.json)$/.test(f))
)
    process.exit(0)

const run = spawnSync('nice', ['-n', '10', 'npm', 'run', '-s', 'typecheck'], {
    cwd: top,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
})
if (run.error) {
    console.error(`typecheck-before-push: could not run the typecheck (${run.error.message}); CI still runs it.`)
    process.exit(0)
}
if (run.status === 0) process.exit(0)
const tail = `${run.stdout}${run.stderr}`.trim().split('\n').slice(-40).join('\n')
console.error(`The typecheck failed in ${top}, so the push is blocked. Fix these errors, then push again:\n${tail}`)
process.exit(2)
