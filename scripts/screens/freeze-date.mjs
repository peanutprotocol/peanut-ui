/** Page init script: `new Date()`, `Date()` and `Date.now()` read one fixed instant; timers keep real time. */
export function freezeDate(now) {
    const RealDate = Date
    globalThis.Date = new Proxy(RealDate, {
        construct: (target, args) => new target(...(args.length ? args : [now])),
        apply: () => new RealDate(now).toString(),
        get: (target, property, receiver) => (property === 'now' ? () => now : Reflect.get(target, property, receiver)),
    })
}
