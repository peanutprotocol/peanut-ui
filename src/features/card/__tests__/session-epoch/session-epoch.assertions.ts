import type { Identity, MountedVerification, Phase, VerificationAdapter } from './adapter-contract';

// Supply this production-bound adapter beside the integration suite. It is deliberately
// absent from the frozen spec: no replacement controller may implement these assertions.
const { verificationAdapter }: { verificationAdapter: VerificationAdapter } =
  require(process.env.PEANUT_VERIFICATION_ADAPTER!);

const A: Identity = { owner: 'synthetic-owner-a', scope: 'a'.repeat(64), generation: 'generation-a' };
const B: Identity = { owner: 'synthetic-owner-b', scope: 'b'.repeat(64), generation: 'generation-b' };
const INITIAL = 'synthetic-initial-sdk-token';
const STALE = 'synthetic-stale-sdk-token';
const FRESH = 'synthetic-fresh-sdk-token';

describe('issued-card verification authentication lifetime', () => {
  let ui: MountedVerification;
  afterEach(async () => { if (ui) await ui.dispose(); });

  function expectNonblockingAndNoIssuance() {
    expect(ui.observations()).toMatchObject({
      blockingOverlayVisible: false, issuanceCalls: 0, applicationCalls: 0,
    });
  }

  async function pendingOperation(phase: Phase) {
    if (phase === 'refresh') {
      const initial = ui.deferNext('start');
      await ui.tapPendingVerification();
      await initial.deliver(INITIAL);
      await ui.flush();
      expect(ui.observations().sdkOpenTokens).toEqual([INITIAL]);
    }
    const response = ui.deferNext(phase);
    if (phase === 'start') await ui.tapPendingVerification();
    else await ui.requestSdkRefresh();
    expect(ui.observations().requests).toEqual(phase === 'start'
      ? [{ phase: 'start', identity: A }]
      : [{ phase: 'start', identity: A }, { phase: 'refresh', identity: A }]);
    expectNonblockingAndNoIssuance();
    return response;
  }

  async function expectStaleSuppressedAndFreshTapWorks(phase: Phase) {
    expect(ui.observations().sdkOpenTokens).toEqual(phase === 'refresh' ? [INITIAL] : []);
    expect(ui.observations().sdkRefreshTokens).toEqual([]);
    expectNonblockingAndNoIssuance();
    const count = ui.observations().requests.length;
    expect(ui.observations().pendingActionVisible).toBe(true);
    const fresh = ui.deferNext('start');
    await ui.tapPendingVerification();
    expect(ui.observations().requests).toHaveLength(count + 1);
    expect(ui.observations().requests[count]).toEqual({ phase: 'start', identity: A });
    await fresh.deliver(FRESH);
    await ui.flush();
    expect(ui.observations().sdkOpenTokens).toEqual(phase === 'refresh' ? [INITIAL, FRESH] : [FRESH]);
    expect(ui.observations().sdkRefreshTokens).toEqual([]);
    expectNonblockingAndNoIssuance();
  }

  describe.each<Phase>(['start', 'refresh'])('delayed %s', (phase) => {
    test('auth clear invalidates in-flight work while the same account stays rendered', async () => {
      ui = await verificationAdapter.mountIssuedCard(A);
      const old = await pendingOperation(phase);
      const count = ui.observations().requests.length;
      await ui.clearAuthenticationKeepingRenderedAccount();
      await old.deliver(STALE);
      await ui.flush();
      expect(ui.observations().sdkOpenTokens).toEqual(phase === 'refresh' ? [INITIAL] : []);
      expect(ui.observations().sdkRefreshTokens).toEqual([]);
      expectNonblockingAndNoIssuance();
      await ui.signIn(A);
      await ui.flush();
      expect(ui.observations().requests).toHaveLength(count);
      await expectStaleSuppressedAndFreshTapWorks(phase);
    });

    test('auth clear and exact identity restoration before response cannot revive old work', async () => {
      ui = await verificationAdapter.mountIssuedCard(A);
      const old = await pendingOperation(phase);
      const count = ui.observations().requests.length;
      await ui.clearAuthenticationKeepingRenderedAccount();
      await ui.signIn({ ...A });
      await old.deliver(STALE);
      await ui.flush();
      expect(ui.observations().requests).toHaveLength(count);
      await expectStaleSuppressedAndFreshTapWorks(phase);
    });

    test('A to B to identical A before response cannot revive old work', async () => {
      ui = await verificationAdapter.mountIssuedCard(A);
      const old = await pendingOperation(phase);
      const count = ui.observations().requests.length;
      await ui.changeAuthenticatedAccount(B);
      await ui.changeAuthenticatedAccount({ ...A });
      await old.deliver(STALE);
      await ui.flush();
      expect(ui.observations().requests).toHaveLength(count);
      await expectStaleSuppressedAndFreshTapWorks(phase);
    });

    test('unchanged authenticated lifetime delivers its response normally', async () => {
      ui = await verificationAdapter.mountIssuedCard(A);
      const response = await pendingOperation(phase);
      await response.deliver(FRESH);
      await ui.flush();
      expect(ui.observations().sdkOpenTokens).toEqual(phase === 'refresh' ? [INITIAL] : [FRESH]);
      expect(ui.observations().sdkRefreshTokens).toEqual(phase === 'refresh' ? [FRESH] : []);
      expectNonblockingAndNoIssuance();
    });
  });
});
