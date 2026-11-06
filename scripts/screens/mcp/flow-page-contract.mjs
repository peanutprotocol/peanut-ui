import assert from 'node:assert/strict';

/**
 * Black-box adapter expected by runFlowPageContract(adapter):
 *
 * - seedPublishedAsset({ screenId, locale }) -> asset descriptor. The descriptor
 *   must identify the immutable published asset (at minimum { id, screenId,
 *   locale }). This is fixture setup only; the subject under test must not
 *   capture, dispatch, or upload assets.
 * - createFlowPage(input, { authenticated }) -> { id, url } (or equivalent
 *   result containing those fields). It calls authenticated tool behavior.
 * - readPage(id) -> persisted page { id, url?, title, description?, locales?,
 *   manifests: [{ title, steps: [{ id, note?, assetId? }] }] }.
 * - publishedManifestCount() -> integer count of newly published page manifests.
 * - maxTotalSteps -> positive integer configured product limit.
 * - discoverTools({ protocolVersion: '2026-07-28' }) -> discovery result; the
 *   result should expose tool name `create_flow_page`.
 * - callTool({ protocolVersion: '2026-07-28', name: 'create_flow_page',
 *   arguments: input, authenticated }) -> result equivalent to createFlowPage.
 * - callLegacyTool({ name: 'create_flow_page', arguments: input,
 *   authenticated }) -> result or an explicit unsupported/compatibility result.
 * - optional counters() -> { captures, dispatches, uploads }; when present these
 *   must remain unchanged across create_flow_page calls.
 *
 * Failure operations reject with an Error (or return an object with `isError`);
 * error text/code is intentionally not prescribed except requestId payload
 * mismatch, which must be distinguishable as a conflict by `isConflict` below.
 */

const DEFAULT_LOCALE = 'en';
const PAGE_TITLE = 'Flow page contract';
const knownScreenIds = ['screen-a', 'screen-b', 'screen-c'];

function inputFor(overrides = {}) {
  return {
    title: PAGE_TITLE,
    description: 'Contract fixture',
    locales: ['en'],
    flows: [
      { title: 'Onboarding', items: [{ id: 'screen-a', note: 'Welcome' }, { id: 'screen-b' }] },
      { title: 'Recovery', items: [{ id: 'screen-a', note: 'Alternative entry' }] },
    ],
    ...overrides,
  };
}

function isConflict(error) {
  return error?.status === 409 || error?.statusCode === 409 ||
    error?.code === 'CONFLICT' || error?.code === 'IDEMPOTENCY_KEY_REUSED' ||
    error?.isConflict === true;
}

async function expectFailure(operation, label, predicate = () => true) {
  let caught;
  try {
    const result = await operation();
    if (result?.isError) caught = result;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${label}: expected failure`);
  assert.ok(predicate(caught), `${label}: failure did not satisfy expected condition`);
}

function pageFromResult(result) {
  const page = result?.page ?? result;
  assert.ok(page && typeof page.id === 'string' && page.id.length > 0, 'result must include page id');
  assert.equal(typeof page.url, 'string', 'result must include shareable URL');
  assert.match(page.url, /^https?:\/\/[^/]+\/collections\/[^/]+\/$|^\/collections\/[^/]+\/$/,
    'page URL must be an existing private /collections/<id>/ link');
  assert.ok(page.url.includes(`/collections/${page.id}/`), 'URL collection id must match returned id');
  return page;
}

function assertManifest(page, expectedFlows, assetsByLocale) {
  const persisted = page.manifests ?? page.flowManifests;
  assert.ok(Array.isArray(persisted), 'page must expose ordered manifests');
  assert.equal(persisted.length, expectedFlows.length, 'one manifest per input flow');
  for (let flowIndex = 0; flowIndex < expectedFlows.length; flowIndex += 1) {
    const expected = expectedFlows[flowIndex];
    const actual = persisted[flowIndex];
    assert.equal(actual.title, expected.title, `flow ${flowIndex} title and order`);
    assert.ok(Array.isArray(actual.steps), `flow ${flowIndex} must contain ordered steps`);
    assert.equal(actual.steps.length, expected.items.length, `flow ${flowIndex} step count`);
    for (let stepIndex = 0; stepIndex < expected.items.length; stepIndex += 1) {
      const wanted = expected.items[stepIndex];
      const step = actual.steps[stepIndex];
      assert.equal(step.id, wanted.id, `flow ${flowIndex} step ${stepIndex} screen id and order`);
      if (wanted.note === undefined) assert.equal(step.note, undefined, 'omitted note remains absent');
      else assert.equal(step.note, wanted.note, 'per-step note is preserved');
      const locale = step.locale ?? DEFAULT_LOCALE;
      const asset = assetsByLocale.get(`${wanted.id}\u0000${locale}`);
      assert.ok(asset, `fixture asset must exist for ${wanted.id}/${locale}`);
      const referenced = step.assetId ?? step.publishedAssetId ?? step.asset?.id;
      assert.equal(referenced, asset.id, 'each step references its immutable published asset');
    }
  }
}

/** Run assertions against an adapter implementing the interface above. */
export async function runFlowPageContract(adapter) {
  for (const method of [
    'seedPublishedAsset', 'createFlowPage', 'readPage', 'publishedManifestCount',
    'discoverTools', 'callTool', 'callLegacyTool',
  ]) assert.equal(typeof adapter?.[method], 'function', `adapter.${method} is required`);
  assert.ok(Number.isInteger(adapter.maxTotalSteps) && adapter.maxTotalSteps > 0,
    'adapter.maxTotalSteps must be a positive integer');

  const countersBefore = typeof adapter.counters === 'function' ? await adapter.counters() : null;
  const assets = new Map();
  for (const screenId of knownScreenIds) {
    const asset = await adapter.seedPublishedAsset({ screenId, locale: 'en' });
    assert.ok(asset?.id, `seeded asset for ${screenId} must have id`);
    assets.set(`${screenId}\u0000en`, asset);
  }

  // Default locale, ordering, repeated screens across flows, independent notes,
  // and permitted repeated steps within one flow.
  const valid = inputFor({ flows: [
    { title: 'Onboarding', items: [{ id: 'screen-a', note: 'Welcome' }, { id: 'screen-b' }, { id: 'screen-a', note: 'Repeat' }] },
    { title: 'Recovery', items: [{ id: 'screen-a', note: 'Alternative entry' }] },
  ] });
  const result = await adapter.createFlowPage(valid, { authenticated: true });
  const page = pageFromResult(result);
  assert.equal(page.title, valid.title);
  assert.equal(page.description, valid.description);
  assert.deepEqual(page.locales ?? ['en'], ['en'], 'omitted locales default to en');
  assertManifest(await adapter.readPage(page.id), valid.flows, assets);
  assert.equal(await adapter.publishedManifestCount(), 1, 'one page manifest is published');

  // Multiple locales resolve each step to locale-specific immutable assets.
  const frA = await adapter.seedPublishedAsset({ screenId: 'screen-a', locale: 'fr' });
  const frB = await adapter.seedPublishedAsset({ screenId: 'screen-b', locale: 'fr' });
  assert.ok(frA?.id && frB?.id, 'French fixture assets must have ids');
  assets.set('screen-a\u0000fr', frA);
  assets.set('screen-b\u0000fr', frB);
  const localized = inputFor({ locales: ['en', 'fr'], flows: [
    { title: 'Localized', items: [{ id: 'screen-a' }, { id: 'screen-b' }] },
  ] });
  const localizedPage = pageFromResult(await adapter.createFlowPage(localized, { authenticated: true }));
  const localizedStored = await adapter.readPage(localizedPage.id);
  assertManifest(localizedStored, localized.flows, assets);
  for (const step of localizedStored.manifests[0].steps) {
    assert.ok(Array.isArray(step.assets) && step.assets.length === 2,
      'localized steps must reference an asset for each requested locale');
    for (const locale of ['en', 'fr']) {
      const asset = step.assets.find(entry => entry.locale === locale);
      assert.equal(asset?.assetId ?? asset?.id, assets.get(`${step.id}\u0000${locale}`).id,
        `localized asset binding for ${step.id}/${locale}`);
    }
  }

  // Authentication and validation failures must happen before publication.
  const invalidCases = [
    ['blank title', inputFor({ title: '  \n ' })],
    ['bad screen id', inputFor({ flows: [{ title: 'Bad id', items: [{ id: '../screen-a' }] }] })],
    ['missing screen', inputFor({ flows: [{ title: 'Missing', items: [{ id: 'screen-does-not-exist' }] }] })],
    ['missing locale asset', inputFor({ locales: ['pt'], flows: [{ title: 'Missing locale', items: [{ id: 'screen-a' }] }] })],
    ['excessive total steps', inputFor({ flows: [{ title: 'Too many', items: Array.from({ length: adapter.maxTotalSteps + 1 }, (_, i) => ({ id: knownScreenIds[i % knownScreenIds.length] })) }] })],
  ];
  for (const [label, invalid] of invalidCases) {
    const before = await adapter.publishedManifestCount();
    await expectFailure(() => adapter.createFlowPage(invalid, { authenticated: true }), label);
    assert.equal(await adapter.publishedManifestCount(), before, `${label} must fail before manifest publication`);
  }
  const beforeUnauthenticated = await adapter.publishedManifestCount();
  await expectFailure(() => adapter.createFlowPage(valid, { authenticated: false }), 'unauthenticated caller');
  assert.equal(await adapter.publishedManifestCount(), beforeUnauthenticated,
    'unauthenticated caller must fail before manifest publication');

  // Concurrent identical retries with the same requestId converge to one page.
  const idempotent = inputFor({ requestId: 'flow-page-contract-idempotency-1' });
  const beforeConcurrent = await adapter.publishedManifestCount();
  const [first, retry, concurrent] = await Promise.all([
    adapter.createFlowPage(idempotent, { authenticated: true }),
    adapter.createFlowPage(idempotent, { authenticated: true }),
    adapter.createFlowPage(idempotent, { authenticated: true }),
  ]);
  const sameId = [first, retry, concurrent].map(r => pageFromResult(r).id);
  assert.deepEqual(new Set(sameId).size, 1, 'concurrent identical requestId calls converge to same page');
  assert.equal(await adapter.publishedManifestCount(), beforeConcurrent + 1,
    'concurrent identical requestId calls publish one manifest');
  const mismatched = { ...idempotent, title: 'Changed payload' };
  await expectFailure(() => adapter.createFlowPage(mismatched, { authenticated: true }),
    'requestId reused with different payload', isConflict);
  assert.equal(await adapter.publishedManifestCount(), beforeConcurrent + 1,
    'idempotency conflict must not publish another manifest');

  // Legacy flat collections remain readable after flow-page creation.
  assert.equal(typeof adapter.readLegacyCollection, 'function',
    'adapter.readLegacyCollection(id) is required for legacy compatibility assertion');
  const legacy = await adapter.readLegacyCollection(page.id);
  assert.ok(legacy && Array.isArray(legacy.items ?? legacy.screens),
    'an existing collection remains readable using the flat collection representation');

  // MCP modern discovery/call contract, plus one legacy compatibility probe.
  const discovery = await adapter.discoverTools({ protocolVersion: '2026-07-28' });
  const discoveredNames = Array.isArray(discovery)
    ? discovery.map(entry => entry.name)
    : (discovery?.tools ?? discovery?.result?.tools ?? []).map(entry => entry.name);
  assert.ok(discoveredNames.includes('create_flow_page'),
    '2026-07-28 MCP tool discovery exposes create_flow_page');
  const modernInput = inputFor({ requestId: 'flow-page-contract-modern-mcp' });
  const modern = pageFromResult(await adapter.callTool({
    protocolVersion: '2026-07-28', name: 'create_flow_page', arguments: modernInput, authenticated: true,
  }));
  assertManifest(await adapter.readPage(modern.id), modernInput.flows, assets);
  const legacyProbe = await adapter.callLegacyTool({
    name: 'create_flow_page', arguments: inputFor({ requestId: 'flow-page-contract-legacy-probe' }), authenticated: true,
  });
  assert.ok(legacyProbe?.isError || legacyProbe?.unsupported === true || legacyProbe?.result || legacyProbe?.id,
    'legacy compatibility probe must explicitly succeed or report unsupported/error');

  if (countersBefore !== null) {
    const countersAfter = await adapter.counters();
    for (const key of ['captures', 'dispatches', 'uploads']) {
      if (key in countersBefore && key in countersAfter)
        assert.equal(countersAfter[key], countersBefore[key], `flow-page operation must not change ${key}`);
    }
  }
  return { pageId: page.id, idempotentPageId: sameId[0], modernPageId: modern.id };
}
