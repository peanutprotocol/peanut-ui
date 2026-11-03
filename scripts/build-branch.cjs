/**
 * The branch a native build is made from. Release builds come from main;
 * anything else is a build for testing, which shows the testing ribbon and
 * takes OTAs from its own channel. CI names the branch (GITHUB_REF_NAME,
 * or GITHUB_HEAD_REF on a pull request); a tag is a release. Locally the
 * checked-out branch names it, never its upstream: a new branch still tracks
 * origin/main or origin/dev until its first push. A detached checkout has no
 * name, so it must set PEANUT_BUILD_BRANCH, which overrides everything.
 */
const { execSync } = require('child_process')
const { createHash } = require('crypto')

const git = (command) => {
    try {
        return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim()
    } catch {
        return ''
    }
}

function buildBranch(env = process.env, readGit = git) {
    if (env.PEANUT_BUILD_BRANCH !== undefined) return env.PEANUT_BUILD_BRANCH.trim()
    if (env.GITHUB_ACTIONS) {
        if (env.GITHUB_REF_TYPE === 'tag') return 'main'
        return (env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '').trim()
    }
    const local = readGit('rev-parse --abbrev-ref HEAD')
    if (local && local !== 'HEAD') return local
    // An unnamed build would read as main: production OTA key, no test channel, no ribbon.
    throw new Error(
        'build-branch: no checked-out branch (detached HEAD or no git). Set PEANUT_BUILD_BRANCH to the branch this build is for, or main for a release build.'
    )
}

/** A build for testing: a known branch that is not main. */
const isTestBuild = (branch) => !!branch && branch !== 'main'

/** The branch's own Capgo channel: lowercase, dashes, within Capgo's name limit. */
const testOtaChannel = (branch) => {
    const slug = branch
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 46)
    const digest = createHash('sha256').update(branch).digest('hex').slice(0, 8)
    return `test-${slug || 'branch'}-${digest}`
}

module.exports = { buildBranch, isTestBuild, testOtaChannel }
