#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): before a `git push` from this repo, run `npm run typecheck` and
// block the push on type errors. CI runs the same check; this finds the error before the push does
// (mono CONTRIBUTING: typecheck before you push). Exit 2 blocks the command and shows stderr to the agent.
//
// The typecheck reads a checked-out tree, so it vouches only for a push of that tree. A push it cannot
// tie to one checked-out tree (another branch, --all, a delete, a path it cannot follow) is left to CI.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8'))
const command = input.tool_input?.command ?? ''
if (!/\bgit\b[\s\S]*\bpush\b/.test(command)) process.exit(0)

// Walk the command's segments in order, following each `cd`, to find every `git push` and the folder it runs in.
const unquote = (s) => s.replace(/^["']|["']$/g, '')
const GIT_VALUE_OPTIONS = new Set([
    '-C',
    '-c',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--config-env',
    '--super-prefix',
])
// The folder a push runs in must be certain. `a || b` runs b only when a fails, a `cd` into a missing folder
// fails, and --git-dir/--work-tree name a repository elsewhere: any of these leaves the push to CI.
const pushes = []
let cwd = input.cwd
let uncertain = /\|\|/.test(command)
for (const segment of command.split(/&&|\|\|?|;|\n/)) {
    const words = segment.trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    if (words[0] === 'cd') {
        if (words[1]) cwd = resolve(cwd, unquote(words[1]))
        if (!existsSync(cwd)) uncertain = true
        continue
    }
    const at = words.indexOf('git')
    if (at === -1) continue
    let i = at + 1
    let dir = cwd
    // Git's own options come before the subcommand; the ones in GIT_VALUE_OPTIONS take the next word.
    while (words[i]?.startsWith('-')) {
        if (/^--(git-dir|work-tree)\b/.test(words[i])) uncertain = true
        if (words[i] === '-C') dir = resolve(dir, unquote(words[i + 1] ?? ''))
        i += GIT_VALUE_OPTIONS.has(words[i]) ? 2 : 1
    }
    if (words[i] === 'push') pushes.push({ dir, args: words.slice(i + 1).map(unquote) })
}

const git = (dir, args) => {
    try {
        return execFileSync('git', ['-C', dir, ...args], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
    } catch {
        return null
    }
}
const skip = (why) => console.error(`typecheck-before-push: ${why}; CI still runs the typecheck.`)
const TYPED = /\.(ts|tsx|mts|cts)$|(^|\/)(tsconfig[^/]*\.json|package\.json)$/
const VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

if (pushes.length > 0 && uncertain) {
    skip('cannot tell for sure which checkout this push runs in, so it was not typechecked here')
    process.exit(0)
}
for (const { dir, args } of pushes) {
    const flags = args.filter((a) => a.startsWith('-'))
    if (flags.some((f) => /^(--delete|-d|--tags)$/.test(f))) continue
    if (flags.some((f) => /^(--all|--mirror|--branches)$/.test(f))) {
        skip('this push sends every branch, not only the checked-out tree, so it was not typechecked here')
        continue
    }
    const top = git(dir, ['rev-parse', '--show-toplevel'])
    if (!top) continue // not a git checkout: nothing to check
    const pkg = resolve(top, 'package.json')
    if (!existsSync(pkg) || !JSON.parse(readFileSync(pkg, 'utf8')).scripts?.typecheck) continue
    if (!existsSync(resolve(top, 'node_modules'))) {
        skip(`${top} has no node_modules, so the typecheck was skipped`)
        continue
    }

    // `git push [remote] [refspec...]`: every source must be the checked-out tree.
    const positional = []
    for (let i = 0; i < args.length; i += 1) {
        if (VALUE_FLAGS.has(args[i])) i += 1
        else if (!args[i].startsWith('-')) positional.push(args[i])
    }
    const refspecs = positional.slice(1).map((r) => r.replace(/^\+/, ''))
    if (refspecs.length > 0 && refspecs.every((r) => r.startsWith(':'))) continue // deletes only
    const head = git(top, ['rev-parse', 'HEAD'])
    const other = refspecs
        .filter((r) => !r.startsWith(':'))
        .map((r) => r.split(':')[0])
        .find((source) => source !== 'HEAD' && git(top, ['rev-parse', '--verify', '-q', `${source}^{commit}`]) !== head)
    if (other) {
        skip(`this push sends ${other}, not the checked-out tree, so it was not typechecked here`)
        continue
    }

    // Only pushes that change types pay for the typecheck: api's runs tsc twice with 6 GB each. The range is the
    // commits not yet on the upstream (or on origin/dev for a new branch); if git cannot tell, check anyway.
    const files =
        git(top, ['diff', '--name-only', '@{upstream}...HEAD']) ??
        git(top, ['diff', '--name-only', 'origin/dev...HEAD'])
    if (files !== null && !files.split('\n').some((f) => TYPED.test(f))) continue

    const run = spawnSync('nice', ['-n', '10', 'npm', 'run', '-s', 'typecheck'], {
        cwd: top,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
    })
    if (run.error) {
        skip(`could not run the typecheck (${run.error.message})`)
        continue
    }
    if (run.status === 0) continue
    const tail = `${run.stdout}${run.stderr}`.trim().split('\n').slice(-40).join('\n')
    console.error(`The typecheck failed in ${top}, so the push is blocked. Fix these errors, then push again:\n${tail}`)
    process.exit(2)
}
process.exit(0)
