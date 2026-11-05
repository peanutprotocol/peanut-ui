import type { PredispatchAdapter, PredispatchHarness, SessionKind, TransportKind } from './predispatch-adapter-contract';

const { predispatchAdapter }: { predispatchAdapter: PredispatchAdapter } =
  require(process.env.PEANUT_PREDISPATCH_ADAPTER!);

const cases: Array<{ session: SessionKind; transport: TransportKind }> = [
  { session: 'token', transport: 'native' },
  { session: 'cookie-only', transport: 'native' },
  { session: 'token', transport: 'web' },
  { session: 'cookie-only', transport: 'web' },
];

describe.each(cases)('pre-dispatch lifetime ($session, $transport)', ({ session, transport }) => {
  let ui: PredispatchHarness;
  beforeEach(async () => {
    ui = await predispatchAdapter.mount({
      session, transport, account: 'synthetic-owner-a',
      scope: 'a'.repeat(64), generation: 'generation-a',
    });
  });
  afterEach(async () => { if (ui) await ui.dispose(); });

  function expectNoWork() {
    expect(ui.observations()).toEqual({ resumeRequests: 0, providerOperations: 0, openingDispatches: 0 });
  }

  test('stale rendered CTA cannot dispatch after auth-clear begins, before cookie clear completes', async () => {
    expectNoWork();
    await ui.beginAuthClearHoldingCookieClear();
    // No rerender or scheduler flush between invalidation and the real click.
    await ui.tapRenderedCardCta();
    await ui.flush();
    expectNoWork();
    await ui.releaseCookieClear();
    await ui.flush();
    expectNoWork();
  });

  test('current authenticated CTA normally dispatches resume', async () => {
    expectNoWork();
    await ui.tapRenderedCardCta();
    await ui.flush();
    expect(ui.observations().resumeRequests).toBe(1);
    expect(ui.observations().openingDispatches).toBe(0);
  });

  test('auth-clear invalidates paperwork parked on readiness before transport dispatch', async () => {
    await ui.holdAuthReadiness();
    await ui.enterPaperworkAndWaitUntilParked();
    expectNoWork();
    await ui.beginAuthClearHoldingCookieClear();
    await ui.releaseAuthReadiness();
    await ui.flush();
    expectNoWork();
    await ui.releaseCookieClear();
    await ui.flush();
    expectNoWork();
  });

  test('account change invalidates paperwork parked on readiness before transport dispatch', async () => {
    await ui.holdAuthReadiness();
    await ui.enterPaperworkAndWaitUntilParked();
    expectNoWork();
    await ui.changeToAccountB();
    await ui.releaseAuthReadiness();
    await ui.flush();
    expectNoWork();
  });

  test('unchanged authenticated paperwork dispatches normally when readiness releases', async () => {
    await ui.holdAuthReadiness();
    await ui.enterPaperworkAndWaitUntilParked();
    expectNoWork();
    await ui.releaseAuthReadiness();
    await ui.flush();
    expect(ui.observations().openingDispatches).toBe(1);
    expect(ui.observations().resumeRequests).toBe(0);
  });
});
