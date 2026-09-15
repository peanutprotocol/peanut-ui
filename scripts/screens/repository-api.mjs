export function repositoryApiPath(repository, path = '') {
    return path ? `repos/${repository}/${path}` : `repos/${repository}`
}
