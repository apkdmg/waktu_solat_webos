import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

// Runs the drop-in <script> build in a sandbox shaped like an old webOS engine:
// no fetch, no Symbol, no Object.setPrototypeOf (webOS 1.x/2.x), and optionally no Promise.
describe('drop-in build on a legacy engine', () => {
  let bundle: string;

  beforeAll(() => {
    execFileSync('npx', ['rollup', '-c'], { stdio: 'ignore' });
    bundle = readFileSync('dist/waktu-solat.min.js', 'utf8');
  });

  function legacyContext(withPromise: boolean, xhrBody?: string) {
    class FakeXhr {
      status = 0;
      responseText = '';
      timeout = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      open() {}
      send() {
        this.status = 200;
        this.responseText = xhrBody || '[]';
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    // A vm context has its own built-ins, so removing them here leaves the test runner untouched.
    const context: Record<string, unknown> = { XMLHttpRequest: FakeXhr, setTimeout, clearTimeout };
    vm.createContext(context);
    vm.runInContext(
      'delete Object.setPrototypeOf; delete globalThis.Symbol; delete globalThis.fetch;' +
        (withPromise ? '' : ' delete globalThis.Promise;') +
        ' globalThis.window = globalThis;',
      context
    );
    expect(vm.runInContext('typeof Object.setPrototypeOf + typeof Symbol', context)).toBe('undefinedundefined');
    return context;
  }

  it('loads without Promise, Symbol or Object.setPrototypeOf', () => {
    const context = legacyContext(false);
    expect(() => vm.runInContext(bundle, context)).not.toThrow();
    const WaktuSolat = context.WaktuSolat as Record<string, unknown>;
    expect(typeof WaktuSolat.WaktuSolatClient).toBe('function');
    expect((WaktuSolat.formatMalaysiaTime as (s: number) => string)(1740781020)).toBe('06:17');
  });

  it('builds errors that pass instanceof without Object.setPrototypeOf', () => {
    const context = legacyContext(false);
    vm.runInContext(bundle, context);
    const result = vm.runInContext(
      'var e = new WaktuSolat.WaktuSolatApiException("boom", 500); [e instanceof WaktuSolat.WaktuSolatApiException, e instanceof Error, e.statusCode, e.message]',
      context
    );
    expect(Array.from(result as unknown[])).toEqual([true, true, 500, 'boom']);
  });

  it('fetches over XMLHttpRequest when a Promise polyfill is present', async () => {
    const zones = JSON.stringify([{ jakimCode: 'SGR01', negeri: 'Selangor', daerah: 'Gombak' }]);
    const context = legacyContext(true, zones);
    vm.runInContext(bundle, context);

    const states = await vm.runInContext('new WaktuSolat.WaktuSolatClient().getStates()', context);

    expect(JSON.parse(JSON.stringify(states))).toEqual([{ negeri: 'Selangor', zones: ['SGR01'] }]);
  });
});
