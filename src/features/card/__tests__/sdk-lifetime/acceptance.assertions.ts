import {describe, it, expect} from 'vitest';
import type {Adapter, Callback, Delivery, Harness, Identity, Launch} from './adapter-contract';

const A: Identity = {owner:'user-a', scope:'a'.repeat(64), generation:'generation-a'};
const callbacks: Callback[] = ['refresh', 'submitted', 'complete'];
const resume = (h: Harness) => h.receipts.filter(r => r.kind === 'resume');
function safe(h: Harness) {
  expect(h.forbiddenCalls).toEqual([]);
  expect(h.receipts.filter(r => ['apply','create-card','issuance','provider'].includes(r.kind))).toEqual([]);
}
function noToken(delivery: Delivery, token: string) {
  expect(JSON.stringify(delivery.value) ?? '').not.toContain(token);
}
async function freshWorks(h: Harness, b: Launch) {
  const root = h.visibleSdkRoot();
  expect(root).not.toBeNull();
  const n = resume(h).length;
  const value = await h.deliver(b, 'refresh');
  await h.settle();
  expect(value.status).toBe('fulfilled');
  expect(resume(h).length).toBe(n + 1);
  expect(resume(h).at(-1)?.identity).toEqual(b.identity);
  const token = resume(h).at(-1)?.responseToken;
  expect(typeof token).toBe('string');
  expect(token?.length).toBeGreaterThan(0);
  expect(JSON.stringify(value.value) ?? '').toContain(token!);
  expect(h.visibleSdkRoot()).toBe(root);
  await h.deliver(b, 'complete');
  await h.settle();
  expect(h.visibleSdkRoot()).toBeNull();
  safe(h);
}

/** Registration is intentionally separate from any implementation adapter. */
export function sdkLifetimeAcceptance(adapter: Adapter) {
  describe(`${adapter.platform}: actual captured SDK launch lifetime`, () => {
    it('current captured launch can refresh and complete (positive control)', async () => {
      const h = await adapter.mount(A);
      try { const a = await h.openThroughUi(); await freshWorks(h, a); }
      finally { await h.dispose(); }
    });

    for (const retirement of ['closed','completed','replaced','unmounted','auth-invalidated','owner-changed','scope-changed','teardown-throws'] as const) {
      for (const event of callbacks) {
        for (const queued of [false, true]) {
          it(`${retirement}: ${queued ? 'previously queued' : 'late'} ${event} cannot affect replacement`, async () => {
            const h = await adapter.mount(A);
            try {
              const a = await h.openThroughUi();
              const queuedDelivery = queued ? h.queue(a, event) : undefined;
              let identity = A;
              if (retirement === 'teardown-throws') h.throwOnTeardown(a);
              if (retirement === 'completed') await h.deliver(a, 'complete');
              else if (retirement === 'unmounted') { await h.leaveRoute(); await h.returnToRoute(); }
              else if (retirement === 'auth-invalidated') { await h.setAuth(null); await h.setAuth(A.owner); }
              else if (retirement === 'owner-changed') {
                identity = {...A, owner:'user-b'};
                await h.setAuth(identity.owner); await h.publishPending(identity);
              } else if (retirement === 'scope-changed' || retirement === 'replaced') {
                identity = retirement === 'scope-changed' ? {...A, scope:'b'.repeat(64)} : {...A, generation:'generation-b'};
                await h.publishPending(identity);
              } else await h.close(a);
              await h.settle();
              // Backend still advertises the pending continuation; reopen same generation
              // for close/complete/auth/unmount cases. Do not mint a generation in adapter.
              await h.publishPending(identity);
              const b = await h.openThroughUi();
              expect(b.id).not.toBe(a.id);
              expect(b.token).not.toBe(a.token);
              expect(b.identity).toEqual(identity);
              const root = h.visibleSdkRoot();
              expect(root).not.toBeNull();
              const count = resume(h).length;
              const launches = h.launches.length;
              const result = await (queuedDelivery ? queuedDelivery() : h.deliver(a, event));
              await h.settle();
              noToken(result, b.token);
              expect(resume(h).length).toBe(count);
              expect(h.launches.length).toBe(launches);
              expect(h.visibleSdkRoot()).toBe(root);
              safe(h);
              await freshWorks(h, b);
            } finally { await h.dispose(); }
          });
        }
      }
    }

    it('refresh started before retirement cannot borrow B identity or token after its late response', async () => {
      const h = await adapter.mount(A);
      try {
        const a = await h.openThroughUi();
        const deferred = h.deferNextResume();
        const before = resume(h).length;
        const pending = h.deliver(a, 'refresh');
        await h.settle();
        expect(resume(h).length).toBe(before + 1);
        expect(resume(h).at(-1)?.identity).toEqual(A);
        await h.close(a);
        const b = await h.openThroughUi();
        expect(b.id).not.toBe(a.id);
        const root = h.visibleSdkRoot();
        const count = resume(h).length;
        await deferred.resolveToken('late-a-refresh-token');
        noToken(await pending, b.token);
        await h.settle();
        expect(resume(h).length).toBe(count);
        expect(h.visibleSdkRoot()).toBe(root);
        safe(h);
        await freshWorks(h, b);
      } finally { await h.dispose(); }
    });
  });
}
