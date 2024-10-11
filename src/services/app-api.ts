export class AppAPI {
    static getUserById(id: string) {
        return fetch('/api/peanut/user/get-user-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accountIdentifier: id,
            }),
        }).then((res) => res.json())
    }
}