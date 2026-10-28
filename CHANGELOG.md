## 1.0.0

* First release of the LG webOS TV / JavaScript port of `waktu_solat_lib`.
* `WaktuSolatClient` with Promise-based methods:
  * `getStates`, `getZones`
  * `getPrayerTimesByZone`, `getPrayerTimesByGps`
  * `getPrayerTimeByDate`, `getPrayerTimeByDateGps`, taking a `Date` (read in Malaysia time) or `{ year, month, day }`
* `formatMalaysiaTime`, `malaysiaDateOf` and `toDate` helpers; no dependency on `Intl` time zone data.
* Optional `waktu-solat-webos/webos` helpers: `getDeviceTimeZone` (webOSTV.js, Luna or an injected request such as Enact's `LS2Request`), `isMalaysiaTimeZone`, `isWebOS`, `webOSVersion`.
* `getStates` is built from `/zones` grouped by state, because the API no longer serves `/v2/negeri`.
* Automatic Imsak (Fajr − 10 min, when missing) and Isyraq (Syuruk + 15 min) calculation.
* `WaktuSolatApiException` for API, network, timeout and parsing errors.
* ES5 output with an `XMLHttpRequest` fallback; loads without errors even on webOS 1.x/2.x.
* ES module, CommonJS and drop-in `<script>` builds, with TypeScript types.
* Packaged webOS example app with remote and Magic Remote support.
