# waktu-solat-webos

`waktu-solat-webos` is a JavaScript/TypeScript library for **LG webOS TV web apps** to fetch Malaysia prayer times from [api.waktusolat.app](https://api.waktusolat.app/docs). It also works in any browser and in Node.js, with plain JavaScript, Enact or any other framework.

It is the LG TV counterpart of the Flutter [`waktu_solat_lib`](https://github.com/apkdmg/waktu_solat_lib), Swift [`WaktuSolatSwift`](https://github.com/apkdmg/waktu_solat_swift), Android [`waktu_solat_android`](https://github.com/apkdmg/waktu_solat_android) and Samsung Tizen [`waktu-solat-tizen`](https://github.com/apkdmg/waktu_solat_tizen) packages.

## Features

- Fetch all states with their zone codes
- Fetch all zones with daerah/negeri (`/zones`)
- Fetch monthly prayer times by zone (`/v2/solat/{zone}`)
- Fetch monthly prayer times by GPS (`/v2/solat/gps/{lat}/{long}`)
- Today's (or any date's) prayer times, worked out in **Malaysia time** even when the TV is set to another time zone
- `formatMalaysiaTime()` for display, with no dependency on the TV's `Intl` data
- Optional webOS helpers: read the TV's time zone (webOSTV.js, Luna or Enact `LS2Request`) and detect the webOS version
- API/network/parsing error handling with `WaktuSolatApiException`
- Auto-calculates:
  - `imsak` = `fajr - 10 minutes` if missing
  - `isyraq` = `syuruk + 15 minutes`
- ES5 output, no dependencies, about 10 KB minified, TypeScript types included

## Compatibility

Every build is ES5. webOS TV 3.x parses nothing newer, and Enact does not transpile packages in `node_modules`. The library uses `fetch` where available and falls back to `XMLHttpRequest`.

What limits older TVs is the API's HTTPS certificate rather than JavaScript. api.waktusolat.app uses Let's Encrypt (ISRG Root X1), and LG documents trust for that root only from webOS TV 5.0. On 3.x/4.x it works only if the TV has received the firmware update that adds it.

| LG TV year | webOS TV | Engine | Status |
|---|---|---|---|
| 2020 and later | 5.0 – 26 | Chromium 68 – 132 | ✅ Supported |
| 2018–2019 | 4.x | Chromium 53 | ⚠️ Works if the TV's firmware trusts ISRG Root X1 |
| 2016–2017 | 3.x | Chromium 38 | ⚠️ As 4.x; uses the `XMLHttpRequest` fallback |
| 2014–2015 | 1.x – 2.x | WebKit | ❌ Not supported (no `Promise`, no trust for the API's certificate). The library still loads without errors, so your app can show a message. |

webOS Re:New upgrades 2022 and later TVs to newer webOS versions each year.

## Installation

### npm (Enact, webpack, Vite, Rollup, …)

```bash
npm install waktu-solat-webos
```

```js
import { WaktuSolatClient } from 'waktu-solat-webos';
```

### Plain `<script>` (no build step)

Copy `node_modules/waktu-solat-webos/dist/waktu-solat.min.js` into your app (for example as `lib/waktu-solat.min.js`) and load it with a classic script tag. It exposes a global `WaktuSolat`:

```html
<script src="lib/waktu-solat.min.js"></script>
<script>
  var client = new WaktuSolat.WaktuSolatClient();
</script>
```

Packaged webOS apps run from `file://`, where `<script type="module">` is blocked, so use the classic `<script>` build there.

### appinfo.json

Nothing to add. webOS has no network permission or origin allow-list, and the API sends `Access-Control-Allow-Origin: *`, so packaged apps can call it directly. Apps can't use cookies under `file://`, so store settings such as the chosen zone in `localStorage`.

## Quick Start

```js
import { WaktuSolatClient, WaktuSolatApiException, formatMalaysiaTime } from 'waktu-solat-webos';

const client = new WaktuSolatClient();

try {
  const today = await client.getPrayerTimeByDate('SGR01', new Date());
  console.log('Subuh', formatMalaysiaTime(today.fajr)); // e.g. "05:48"
} catch (e) {
  if (e instanceof WaktuSolatApiException) {
    console.error('API error:', e.message);
  }
}
```

Every method returns a Promise. In plain ES5 code (for webOS 3.x/4.x apps) use `.then()`:

```js
client.getPrayerTimeByDate('SGR01', new Date()).then(function (today) {
  console.log('Subuh', WaktuSolat.formatMalaysiaTime(today.fajr));
}, function (e) {
  console.error(e.message);
});
```

## Guide: How To Use

### 1. Get all states

```js
const states = await client.getStates();
states.forEach((state) => console.log(state.negeri, state.zones));
```

### 2. Get all zones

```js
const zones = await client.getZones();
zones.slice(0, 5).forEach((zone) => console.log(`${zone.jakimCode} - ${zone.daerah} (${zone.negeri})`));
```

### 3. Get monthly prayer times by zone

```js
const data = await client.getPrayerTimesByZone('SGR01', { year: 2026, month: 2 });

const firstDay = data.prayerTime[0];
console.log(firstDay.hijri, formatMalaysiaTime(firstDay.fajr), formatMalaysiaTime(firstDay.maghrib));
```

### 4. Get monthly prayer times by GPS

```js
const data = await client.getPrayerTimesByGps(3.1390, 101.6869);
console.log('Detected zone:', data.zone);
```

### 5. Get prayer times for one date

Pass a `Date` and the library uses the **Malaysia calendar date at that moment**, so `new Date()` always means "today in Malaysia", even if the TV is set to another time zone. Pass `{ year, month, day }` for an exact date.

```js
const today = await client.getPrayerTimeByDate('SGR01', new Date());
const raya = await client.getPrayerTimeByDate('SGR01', { year: 2026, month: 3, day: 20 });

const byGps = await client.getPrayerTimeByDateGps(3.1390, 101.6869, new Date());
```

Each returns `null` if the API has no entry for that day.

### 6. Show times

API times are Unix seconds. `formatMalaysiaTime()` turns one into 24-hour Malaysia time using fixed UTC+8 arithmetic. Malaysia has no daylight saving time, so this is exact and works on every TV, including ones without `Intl` time zone data. `toDate()` gives a `Date` if you prefer.

```js
import { formatMalaysiaTime, malaysiaDateOf, toDate } from 'waktu-solat-webos';

formatMalaysiaTime(today.fajr);   // "05:48"
formatMalaysiaTime(null);         // "--:--"
malaysiaDateOf(new Date());       // { year: 2026, month: 10, day: 29 }
toDate(today.fajr);               // Date
```

## webOS helpers

`waktu-solat-webos/webos` has optional helpers for LG TVs. They are also on the `WaktuSolat` global in the `<script>` build. You don't need them to fetch prayer times.

```js
import { getDeviceTimeZone, isMalaysiaTimeZone, isWebOS, webOSVersion } from 'waktu-solat-webos/webos';

isWebOS();        // true on an LG TV (user agent contains "Web0S")
webOSVersion();   // "6", "24", … guessed from the Chromium version; null if unknown

const timeZone = await getDeviceTimeZone();   // e.g. "Asia/Kuala_Lumpur", or null
if (!isMalaysiaTimeZone(timeZone)) {
  // Times are still shown in Malaysia time; you might tell the user.
}
```

`getDeviceTimeZone()` tries `webOS.systemInfo.timezone` (if webOSTV.js is loaded), then the Luna call `luna://com.palm.systemservice/time/getSystemTime`, then `Intl`. It never rejects. In Enact apps, pass `LS2Request` so it doesn't need webOSTV.js:

```js
import LS2Request from '@enact/webos/LS2Request';
import { getDeviceTimeZone } from 'waktu-solat-webos/webos';

const request = (service, method, parameters) =>
  new Promise((resolve, reject) =>
    new LS2Request().send({ service, method, parameters, onSuccess: resolve, onFailure: reject })
  );

const timeZone = await getDeviceTimeZone({ request });
```

## Error Handling

All failures (HTTP errors, network errors and timeouts, unexpected JSON) reject with `WaktuSolatApiException`:

```js
try {
  await client.getPrayerTimesByZone('INVALID_ZONE');
} catch (e) {
  console.log(e.message);
  console.log(e.statusCode); // e.g. 404, or null for network errors
  console.log(e.apiError);   // parsed {"status": "error", "message": ...} body, if any
}
```

On a TV that doesn't trust the API's certificate (see [Compatibility](#compatibility)), requests fail with a network error.

## Options

```js
const client = new WaktuSolatClient({
  timeoutMs: 15000,         // request timeout; 0 disables it (default 15000)
  fetch: myFetch,           // custom fetch implementation (default: global fetch, else XMLHttpRequest)
  baseUrl: 'https://...',   // a proxy or test server (default https://api.waktusolat.app)
});
```

Requests are plain GETs with no custom headers, which keeps them clear of CORS preflights. If you set a proxy as `baseUrl`, keep it that way.

## Using with frameworks

The library has no framework dependency and doesn't touch the DOM. Importing it has no side effects, so it is safe in server-side rendering.

### Enact (LG's framework)

Enact apps import the package like any other. Enact CLI doesn't transpile `node_modules`, which is why this package ships ES5. Your own code is transpiled for the browsers in your app's `browserslist`. Enact 5 and the Limestone theme target recent TVs (Chromium 119+, webOS 25+), so to reach older TVs set a wider `browserslist` (for example `chrome >= 68`) or use Enact 4 with Sandstone.

```jsx
import { useEffect, useState } from 'react';
import { WaktuSolatClient, formatMalaysiaTime } from 'waktu-solat-webos';

const client = new WaktuSolatClient();

export function PrayerTimes({ zone = 'SGR01' }) {
  const [today, setToday] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    client.getPrayerTimeByDate(zone, new Date()).then(
      (result) => active && setToday(result),
      (e) => active && setError(e.message)
    );
    return () => {
      active = false;
    };
  }, [zone]);

  if (error) return <p>{error}</p>;
  if (!today) return <p>Loading…</p>;
  return (
    <ul>
      <li>Subuh {formatMalaysiaTime(today.fajr)}</li>
      <li>Zohor {formatMalaysiaTime(today.dhuhr)}</li>
      <li>Asar {formatMalaysiaTime(today.asr)}</li>
      <li>Maghrib {formatMalaysiaTime(today.maghrib)}</li>
      <li>Isyak {formatMalaysiaTime(today.isha)}</li>
    </ul>
  );
}
```

Wrap the list items in Enact's `Spottable` (or use theme components such as `Item`) to make them focusable with the remote.

### React, Preact

The Enact example above is plain React and works as is (for Preact, import the hooks from `preact/hooks`). With TanStack Query:

```js
const { data: today } = useQuery({
  queryKey: ['prayer-time', zone],
  queryFn: () => client.getPrayerTimeByDate(zone, new Date()),
});
```

### Vue 3

```vue
<script setup>
import { ref, watchEffect } from 'vue';
import { WaktuSolatClient, formatMalaysiaTime } from 'waktu-solat-webos';

const props = defineProps({ zone: { type: String, default: 'SGR01' } });
const client = new WaktuSolatClient();
const today = ref(null);
const error = ref(null);

watchEffect(async (onCleanup) => {
  let active = true;
  onCleanup(() => (active = false));
  try {
    const result = await client.getPrayerTimeByDate(props.zone, new Date());
    if (active) today.value = result;
  } catch (e) {
    if (active) error.value = e.message;
  }
});
</script>

<template>
  <p v-if="error">{{ error }}</p>
  <p v-else-if="!today">Loading…</p>
  <p v-else>Subuh {{ formatMalaysiaTime(today.fajr) }} · Maghrib {{ formatMalaysiaTime(today.maghrib) }}</p>
</template>
```

### Angular

```ts
import { Component, OnInit, signal } from '@angular/core';
import { WaktuSolatClient, PrayerTime, formatMalaysiaTime } from 'waktu-solat-webos';

@Component({
  selector: 'app-prayer-times',
  standalone: true,
  template: `
    @if (error()) {
      <p>{{ error() }}</p>
    } @else if (today(); as t) {
      <p>Subuh {{ format(t.fajr) }} · Maghrib {{ format(t.maghrib) }}</p>
    } @else {
      <p>Loading…</p>
    }
  `,
})
export class PrayerTimesComponent implements OnInit {
  private readonly client = new WaktuSolatClient();
  readonly today = signal<PrayerTime | null>(null);
  readonly error = signal<string | null>(null);
  readonly format = formatMalaysiaTime;

  async ngOnInit() {
    try {
      this.today.set(await this.client.getPrayerTimeByDate('SGR01', new Date()));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
```

### Svelte 5

```svelte
<script>
  import { WaktuSolatClient, formatMalaysiaTime } from 'waktu-solat-webos';

  let { zone = 'SGR01' } = $props();
  const client = new WaktuSolatClient();
  const today = $derived(client.getPrayerTimeByDate(zone, new Date()));
</script>

{#await today}
  <p>Loading…</p>
{:then t}
  <p>Subuh {t ? formatMalaysiaTime(t.fajr) : '--:--'}</p>
{:catch e}
  <p>{e.message}</p>
{/await}
```

### Lightning (LightningJS 2)

```js
import { Lightning } from '@lightningjs/sdk';
import { WaktuSolatClient, formatMalaysiaTime } from 'waktu-solat-webos';

const client = new WaktuSolatClient();

export default class PrayerTimes extends Lightning.Component {
  static _template() {
    return { Label: { text: { text: 'Loading…', fontSize: 48 } } };
  }

  _init() {
    client.getPrayerTimeByDate('SGR01', new Date()).then(
      (today) => this.tag('Label').patch({ text: { text: 'Subuh ' + (today ? formatMalaysiaTime(today.fajr) : '--:--') } }),
      (e) => this.tag('Label').patch({ text: { text: e.message } })
    );
  }
}
```

### Node.js (18+)

```js
import { WaktuSolatClient } from 'waktu-solat-webos';

const states = await new WaktuSolatClient().getStates();
console.log(states.map((state) => state.negeri));
```

## Main Types

- `WaktuSolatClient`
- `WaktuState`
- `ZoneInfo`
- `PrayerTime`
- `SolatV2`
- `CalendarDate`
- `ApiError`
- `WaktuSolatApiException`
- `formatMalaysiaTime()`, `malaysiaDateOf()`, `toDate()`
- From `waktu-solat-webos/webos`: `getDeviceTimeZone()`, `isMalaysiaTimeZone()`, `isWebOS()`, `webOSVersion()`

## Example TV App

A packaged webOS app lives in [`example/`](example). It shows a zone list you can move through with the remote (▲ ▼ to pick, OK to show, Back to exit) or the Magic Remote pointer, plus today's times with the next prayer highlighted. It also shows a notice when the TV isn't set to Malaysia time.

```bash
npm install
npm run example   # builds the library and copies it to example/lib/
```

Then, with LG's CLI (`npm install -g @webos-tools/cli`, Node 20+):

```bash
ares-package example                        # creates com.apkdmg.waktusolat.example_1.0.0_all.ipk
ares-launch -s 24 -sp <simulator path> example   # run in the webOS TV 24 Simulator
ares-install -d <tv> com.apkdmg.waktusolat.example_1.0.0_all.ipk   # install on a TV in Developer Mode
```

Or use LG's **webOS Studio** extension for VS Code. To try it in a desktop browser, serve the folder (for example `npx serve example`) and use the arrow keys and Enter.

The Back key (461) exits via `webOS.platformBack()` when LG's [webOSTV.js](https://webostv.developer.lge.com/develop/references/webostvjs-introduction) is loaded (add it to `index.html`), and `window.close()` otherwise.

## Development

```bash
npm test             # unit tests, including an old-engine sandbox test
npm run test:live    # tests against the real API
npm run build        # dist/: ES modules, CommonJS, <script> build, types
npm run check:es5    # fails if a built file uses syntax or APIs older TVs lack
```

### Releasing

1. Update `version` in `package.json` and `CHANGELOG.md`.
2. `npm publish` (runs the type check, tests, build and ES5 check first).
3. Tag and push: `git tag <version> && git push origin <version>`.

## Credits

This library uses the [Malaysia Prayer Time API](https://api.waktusolat.app/docs) created by [Muhammad Fareez Iqmal](https://iqfareez.com/about), a Software Engineer specializing in Flutter, Laravel, and .NET technologies. The API provides accurate prayer times data for all locations in Malaysia.

The data is collected from [e-solat JAKIM](https://www.e-solat.gov.my/) and stored in a database to maintain stability and availability. For more technical information, visit the API repository at [https://github.com/mptwaktusolat/api-waktusolat](https://github.com/mptwaktusolat/api-waktusolat).

## License

MIT. See [LICENSE](LICENSE).
