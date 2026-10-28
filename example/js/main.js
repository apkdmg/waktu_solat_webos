/* Example LG webOS TV app for waktu-solat-webos. Plain ES5 so it runs on webOS 3.x and newer. */
(function () {
    'use strict';

    var KEY = { UP: 38, DOWN: 40, ENTER: 13, BACK: 461, ESCAPE: 27 };
    var VISIBLE_ROWS = 12;
    var NAMES = [
        ['Imsak', 'imsak'], ['Subuh', 'fajr'], ['Syuruk', 'syuruk'], ['Isyraq', 'isyraq'],
        ['Zohor', 'dhuhr'], ['Asar', 'asr'], ['Maghrib', 'maghrib'], ['Isyak', 'isha']
    ];

    var client = new WaktuSolat.WaktuSolatClient();
    var zones = [];
    var selected = 0;
    var firstRow = 0;
    var activeZone = loadZone() || 'SGR01';
    var today = null;

    function $(id) { return document.getElementById(id); }

    function loadZone() {
        try { return localStorage.getItem('zone'); } catch (e) { return null; }
    }

    function saveZone(zone) {
        try { localStorage.setItem('zone', zone); } catch (e) { /* storage unavailable */ }
    }

    function show(id, message) {
        var el = $(id);
        el.textContent = message || '';
        el.hidden = !message;
    }

    function renderZones() {
        var list = $('zone-list');
        if (selected < firstRow) firstRow = selected;
        if (selected >= firstRow + VISIBLE_ROWS) firstRow = selected - VISIBLE_ROWS + 1;
        list.innerHTML = '';
        for (var i = firstRow; i < Math.min(zones.length, firstRow + VISIBLE_ROWS); i++) {
            var li = document.createElement('li');
            li.className = (i === selected ? 'selected ' : '') + (zones[i].jakimCode === activeZone ? 'active' : '');
            li.setAttribute('data-index', String(i));
            li.innerHTML = '<span class="code"></span><span class="area"></span>';
            li.firstChild.textContent = zones[i].jakimCode;
            li.lastChild.textContent = zones[i].daerah;
            list.appendChild(li);
        }
    }

    function renderTimes() {
        var list = $('times');
        list.innerHTML = '';
        if (!today) return;

        var nowSeconds = Date.now() / 1000;
        var nextKey = null;
        for (var i = 0; i < NAMES.length; i++) {
            var t = today[NAMES[i][1]];
            if (t !== null && t > nowSeconds) { nextKey = NAMES[i][1]; break; }
        }

        for (var j = 0; j < NAMES.length; j++) {
            var li = document.createElement('li');
            if (NAMES[j][1] === nextKey) li.className = 'next';
            li.innerHTML = '<span class="name"></span><span class="time"></span>';
            li.firstChild.textContent = NAMES[j][0];
            li.lastChild.textContent = WaktuSolat.formatMalaysiaTime(today[NAMES[j][1]]);
            list.appendChild(li);
        }
    }

    function renderClock() {
        $('clock').textContent = WaktuSolat.formatMalaysiaTime(Math.floor(Date.now() / 1000));
    }

    function loadToday() {
        $('meta').textContent = activeZone + ' · Memuatkan…';
        // new Date() is read as "today in Malaysia", whatever time zone the TV is set to.
        client.getPrayerTimeByDate(activeZone, new Date()).then(function (prayerTime) {
            today = prayerTime;
            show('error', '');
            $('meta').textContent = activeZone + ' · ' + (prayerTime ? 'Hijri ' + prayerTime.hijri : 'Tiada data');
            renderTimes();
        }, function (e) {
            show('error', e.message);
            $('meta').textContent = activeZone;
        });
    }

    function selectZone(index) {
        if (!zones[index]) return;
        selected = index;
        activeZone = zones[index].jakimCode;
        saveZone(activeZone);
        renderZones();
        loadToday();
    }

    function exitApp() {
        // On the root screen LG asks apps to show the system exit prompt (webOS 6+)
        // via webOSTV.js, or to close themselves.
        if (window.webOS && typeof window.webOS.platformBack === 'function') {
            window.webOS.platformBack();
        } else {
            window.close();
        }
    }

    function onKey(event) {
        switch (event.keyCode) {
            case KEY.UP:
                selected = Math.max(0, selected - 1);
                renderZones();
                break;
            case KEY.DOWN:
                selected = Math.min(zones.length - 1, selected + 1);
                renderZones();
                break;
            case KEY.ENTER:
                selectZone(selected);
                break;
            case KEY.BACK:
            case KEY.ESCAPE:
                exitApp();
                break;
            default:
                return;
        }
        event.preventDefault();
    }

    // Magic Remote pointer: hovering moves the selection, clicking picks the zone.
    function itemIndex(event) {
        var node = event.target;
        while (node && node !== document && !node.getAttribute('data-index')) node = node.parentNode;
        return node && node !== document ? parseInt(node.getAttribute('data-index'), 10) : -1;
    }

    function onPointerMove(event) {
        var index = itemIndex(event);
        if (index >= 0 && index !== selected) {
            selected = index;
            renderZones();
        }
    }

    function onClick(event) {
        var index = itemIndex(event);
        if (index >= 0) selectZone(index);
    }

    function checkTimeZone() {
        WaktuSolat.getDeviceTimeZone().then(function (timeZone) {
            if (timeZone && !WaktuSolat.isMalaysiaTimeZone(timeZone)) {
                show('notice', 'Zon masa TV ialah ' + timeZone + '. Waktu dipaparkan dalam waktu Malaysia.');
            }
        });
    }

    function init() {
        document.addEventListener('keydown', onKey);
        $('zone-list').addEventListener('mousemove', onPointerMove);
        $('zone-list').addEventListener('click', onClick);
        renderClock();
        setInterval(function () {
            renderClock();
            renderTimes();
        }, 15000);

        client.getZones().then(function (result) {
            zones = result;
            for (var i = 0; i < zones.length; i++) {
                if (zones[i].jakimCode === activeZone) selected = i;
            }
            firstRow = Math.max(0, selected - Math.floor(VISIBLE_ROWS / 2));
            renderZones();
        }, function (e) {
            show('error', e.message);
        });

        loadToday();
        checkTimeZone();
    }

    window.onload = init;
})();
