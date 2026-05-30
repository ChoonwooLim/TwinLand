# 3D 위치 검색 기능 이식 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JooJooLand legacy-map 의 3D 위치 검색(주소·도시명 4단계 지오코딩 + 위경도 직접 입력)을 TwinLand 의 `legacy-map` 으로 전 세계 범위로 이식한다.

**Architecture:** `/map` 은 React `Map.jsx` 가 정적 Cesium 앱 `frontend/public/legacy-map/index.html` 을 iframe 으로 띄우는 구조다. 변경은 `legacy-map` 의 정적 파일 2개(`index.html`, `cesium-app.js`)에만 발생하며 백엔드는 손대지 않는다(`/api/vworld/address` 프록시·`config.js` 키 주입이 이미 존재). JooJooLand 의 검증된 함수를 그대로 복사 이식한다.

**Tech Stack:** Vanilla JS, CesiumJS, VWorld 지오코더(getcoord), Cesium Ion IonGeocoderService, OpenStreetMap Nominatim.

---

## 사전 메모 (구현 전 반드시 읽을 것)

- **설계서**: [`docs/superpowers/specs/2026-05-30-3d-location-search-design.md`](../specs/2026-05-30-3d-location-search-design.md)
- **이식 원본**: `C:\WORK\JooJooLand\frontend\public\legacy-map\` (동일 파일 구조).
- **TwinLand 현재 상태(중요)**:
  - `index.html`: `#group-3d-only`(288–296행)에 `#fly-address`+`#fly-btn` **이미 존재**(구 placeholder `주소 → 이동 (예: 서울 강남구)`). 위/경도 셀은 **없음**.
  - `cesium-app.js`: `wireControls`(481–509행)가 `#fly-address`/`#fly-btn` → `flyToAddress` 를 **이미 배선**. 단 `flyToAddress`(453–479행)는 VWorld 단일 tier **구버전**이고, `parseLatLng`/`flyToLngLat`/`flyToGeocodeDestination`/`ionGeocode`/`osmGeocode` 는 **부재**. 위/경도 셀 배선도 **부재**.
- **TDD 예외(의도적)**: legacy-map 은 테스트 하니스가 없는 순수 vanilla-JS 정적 앱이다(Vitest/RTL/Playwright 는 `frontend/src` React 앱 대상). 함수들이 IIFE 클로저 내부에 있어 export 되지 않으므로, 단위 테스트를 붙이려면 faithful-port 범위를 벗어나는 리팩토링이 필요하다. 따라서 설계서 §7 합의대로 **각 태스크는 편집 → 빌드 검증 → 수동 스모크 → 커밋** 순서로 진행한다. 자동 테스트는 작성하지 않는다.
- 코드 블록은 **JooJooLand 원본 그대로**다. 한 글자도 바꾸지 말 것(주석·인라인 스타일 포함).

---

## Task 1: 검색 박스 HTML 추가 (placeholder 갱신 + 위경도 셀)

**Files:**
- Modify: `frontend/public/legacy-map/index.html:292-295`

- [ ] **Step 1: 주소 div 를 placeholder 갱신 + 위경도 셀 포함 블록으로 교체**

`index.html` 의 `#group-3d-only` 안, 아래 기존 블록(292–295행)을 찾는다:

```html
          <div style="display:flex;gap:4px;margin-top:6px;">
            <input type="text" id="fly-address" placeholder="주소 → 이동 (예: 서울 강남구)" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;" />
            <button id="fly-btn" style="padding:4px 10px;background:#1a237e;color:white;border:none;border-radius:3px;cursor:pointer;font-size:12px;">이동</button>
          </div>
```

다음으로 교체한다(placeholder 에 `도시명`·`Tokyo` 추가 + 위/경도 행 신규):

```html
          <div style="display:flex;gap:4px;margin-top:6px;">
            <input type="text" id="fly-address" placeholder="주소·도시명 → 이동 (예: 서울 강남구 / Tokyo)" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;" />
            <button id="fly-btn" style="padding:4px 10px;background:#1a237e;color:white;border:none;border-radius:3px;cursor:pointer;font-size:12px;">이동</button>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;align-items:center;">
            <label for="fly-lat" style="font-size:11px;color:var(--text-dim,#9aa);white-space:nowrap;">위도</label>
            <input type="text" id="fly-lat" inputmode="decimal" placeholder="예: 37.5665" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;" />
            <label for="fly-lng" style="font-size:11px;color:var(--text-dim,#9aa);white-space:nowrap;">경도</label>
            <input type="text" id="fly-lng" inputmode="decimal" placeholder="예: 126.978" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;" />
            <button id="fly-latlng-btn" style="padding:4px 10px;background:#1a237e;color:white;border:none;border-radius:3px;cursor:pointer;font-size:12px;">이동</button>
          </div>
```

- [ ] **Step 2: 마크업 정합성 확인**

`#group-3d-only` 블록이 여전히 `</div>` 로 올바르게 닫히는지(교체 후 div 2개 + 닫는 div) 육안 확인.
새 ID 4종이 존재하는지 확인:

Run: `rg -n "fly-address|fly-btn|fly-lat|fly-lng|fly-latlng-btn" frontend/public/legacy-map/index.html`
Expected: `fly-address`, `fly-btn`, `fly-lat`, `fly-lng`, `fly-latlng-btn` 모두 매칭(각 1회).

- [ ] **Step 3: 커밋**

```bash
git add frontend/public/legacy-map/index.html
git commit -m "feat(legacy-map): 3D 위치 검색 placeholder 갱신 + 위경도 입력 셀 추가"
```

---

## Task 2: 지오코딩 헬퍼 + 4단계 flyToAddress 이식 (구버전 교체)

**Files:**
- Modify: `frontend/public/legacy-map/cesium-app.js:453-479` (기존 `flyToAddress` 전체 교체)

- [ ] **Step 1: 기존 VWorld 단일 tier `flyToAddress` 를 찾는다**

`cesium-app.js` 453–479행의 아래 블록 전체:

```javascript
  async function flyToAddress(address) {
    if (!viewer || !address) return;
    const key = window.VWORLD_KEY;
    if (!key) { alert('VWorld 키 없음'); return; }
    const url = `/api/vworld/address?service=address&request=getcoord&address=${encodeURIComponent(address)}&type=road&key=${key}&format=json`;
    try {
      let resp = await fetch(url);
      let json = await resp.json();
      let pt = json?.response?.result?.point;
      if (!pt) {
        const url2 = url.replace('type=road', 'type=parcel');
        resp = await fetch(url2);
        json = await resp.json();
        pt = json?.response?.result?.point;
      }
      if (!pt) { alert(`주소 못 찾음: ${address}`); return; }
      const lng = parseFloat(pt.x), lat = parseFloat(pt.y);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1500),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 2.0,
      });
    } catch (e) {
      console.error('[Cesium] flyToAddress 오류:', e);
      alert('주소 검색 실패');
    }
  }
```

- [ ] **Step 2: 위 블록 전체를 아래 6개 함수로 교체**

(JooJooLand `cesium-app.js` 453–557행 원본 그대로. `function` 선언이라 hoisting 되므로 `flyToAddress` 보다 헬퍼가 앞에 와도/뒤에 와도 무방하나, 가독성을 위해 헬퍼 → flyToAddress 순서로 둔다.)

```javascript
  // "37.5665, 126.9780" / "37.5665 126.978" 형태의 위경도 입력 파싱 (위도 우선)
  function parseLatLng(s) {
    const m = s.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lng: a }; // 경도,위도 순 보정
    return null;
  }

  function flyToLngLat(lng, lat, height) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
      duration: 2.0,
    });
  }

  // 지오코더 결과(사각형=도시/지역, Cartesian3=지점)에 맞춰 카메라 이동
  function flyToGeocodeDestination(dest) {
    if (dest instanceof Cesium.Rectangle) {
      const c = Cesium.Rectangle.center(dest);
      const sw = Cesium.Cartographic.toCartesian(Cesium.Rectangle.southwest(dest));
      const ne = Cesium.Cartographic.toCartesian(Cesium.Rectangle.northeast(dest));
      const diag = Cesium.Cartesian3.distance(sw, ne);
      flyToLngLat(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), Math.min(200000, Math.max(2500, diag * 0.8)));
    } else if (dest) {
      const carto = Cesium.Cartographic.fromCartesian(dest);
      flyToLngLat(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), Math.max(2000, carto.height + 2000));
    }
  }

  // 전 세계 지명 검색 (도쿄/맨해튼/캘리포니아 등) — Cesium Ion 지오코더 (토큰 geocode 권한 필요)
  let ionGeocoder = null;
  async function ionGeocode(query) {
    if (!window.CESIUM_ION_TOKEN) return null;
    if (!ionGeocoder) ionGeocoder = new Cesium.IonGeocoderService({ scene: viewer.scene });
    const results = await ionGeocoder.geocode(query, Cesium.GeocodeType.SEARCH);
    return (results && results.length) ? results[0].destination : null;
  }

  // 전 세계 지명 폴백 — OpenStreetMap Nominatim (토큰 불필요)
  // 대표 지점(lat/lon) 중심으로 이동하고, bbox 크기로 높이를 추정(3km~200km).
  // (예: "도쿄"는 도쿄도 소속 태평양 섬까지 포함해 bbox 중심이 바다에 찍히므로 대표 지점 사용)
  async function osmGeocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const arr = await resp.json();
    if (!arr || !arr.length) return null;
    const r = arr[0];
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    let height = 3000;
    if (r.boundingbox && r.boundingbox.length === 4) {
      const [s, n, w, e] = r.boundingbox.map(parseFloat);
      const diag = Cesium.Cartesian3.distance(Cesium.Cartesian3.fromDegrees(w, s), Cesium.Cartesian3.fromDegrees(e, n));
      height = Math.min(200000, Math.max(3000, diag * 0.5));
    }
    return { lng, lat, height };
  }

  async function flyToAddress(query) {
    if (!viewer || !query) return;

    // 1) 위도/경도 직접 입력
    const coord = parseLatLng(query);
    if (coord) { flyToLngLat(coord.lng, coord.lat, 2000); return; }

    // 2) 한국 주소 — VWorld 지오코더
    const key = window.VWORLD_KEY;
    if (key) {
      try {
        const url = `/api/vworld/address?service=address&request=getcoord&address=${encodeURIComponent(query)}&type=road&key=${key}&format=json`;
        let resp = await fetch(url);
        let json = await resp.json();
        let pt = json?.response?.result?.point;
        if (!pt) {
          resp = await fetch(url.replace('type=road', 'type=parcel'));
          json = await resp.json();
          pt = json?.response?.result?.point;
        }
        if (pt) { flyToLngLat(parseFloat(pt.x), parseFloat(pt.y), 1500); return; }
      } catch (e) {
        console.warn('[Cesium] VWorld 지오코딩 실패, 전역 검색으로 전환:', e?.message || e);
      }
    }

    // 3) 전 세계 지명 — Cesium Ion 지오코더 (토큰 geocode 권한이 있을 때)
    try {
      const dest = await ionGeocode(query);
      if (dest) { flyToGeocodeDestination(dest); return; }
    } catch (e) {
      console.warn('[Cesium] Ion 지오코딩 실패, OSM 으로 전환:', e?.message || e);
    }

    // 4) 전 세계 지명 폴백 — OSM Nominatim (토큰 불필요)
    try {
      const d = await osmGeocode(query);
      if (d) { flyToLngLat(d.lng, d.lat, d.height); return; }
    } catch (e) {
      console.error('[Cesium] OSM 지오코딩 오류:', e);
    }

    alert(`위치를 찾지 못했습니다: ${query}\n(예: "서울 강남구", "Tokyo", "Manhattan", 또는 "37.5665, 126.9780")`);
  }
```

- [ ] **Step 3: 정의 중복/누락 확인**

Run: `rg -n "function parseLatLng|function flyToLngLat|function flyToGeocodeDestination|async function ionGeocode|async function osmGeocode|async function flyToAddress" frontend/public/legacy-map/cesium-app.js`
Expected: 6개 함수 각 정확히 **1회**씩 매칭(구버전 `flyToAddress(address)` 가 사라지고 새 `flyToAddress(query)` 만 존재).

- [ ] **Step 4: 빌드로 문법 검증**

Run: `cd frontend && npm run build`
Expected: 빌드 성공(에러 없이 완료). legacy-map 은 정적 복사 대상이라 번들 에러는 안 나지만, 빌드가 깨지지 않는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/legacy-map/cesium-app.js
git commit -m "feat(legacy-map): flyToAddress 4단계 지오코딩(좌표/VWorld/Ion/OSM) 이식"
```

---

## Task 3: 위/경도 직접 입력 셀 배선 (wireControls 확장)

**Files:**
- Modify: `frontend/public/legacy-map/cesium-app.js` (`wireControls` 내부, 주소 버튼 배선 직후)

- [ ] **Step 1: 삽입 위치를 찾는다**

`wireControls` 안에서 주소 입력 배선 블록(아래)을 찾는다:

```javascript
    if (btn && !btn.dataset.wired) {
      const go = () => flyToAddress(input.value.trim());
      btn.addEventListener('click', go);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      btn.dataset.wired = '1';
    }
```

바로 다음 줄(빈 줄)과 `// 필지 스타일 컨트롤` 주석 **사이**가 삽입 지점이다.

- [ ] **Step 2: 위 블록 직후에 위/경도 배선을 추가**

위 `if (btn ...) { ... }` 닫는 중괄호 다음, `// 필지 스타일 컨트롤` 주석 앞에 아래를 삽입한다(JooJooLand 589–607행 원본 그대로):

```javascript

    // 위도/경도 직접 입력 셀
    const latIn = document.getElementById('fly-lat');
    const lngIn = document.getElementById('fly-lng');
    const latlngBtn = document.getElementById('fly-latlng-btn');
    if (latlngBtn && latIn && lngIn && !latlngBtn.dataset.wired) {
      const goCoord = () => {
        const lat = parseFloat(latIn.value), lng = parseFloat(lngIn.value);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          alert('위도(-90~90)와 경도(-180~180)를 올바르게 입력하세요.');
          return;
        }
        flyToLngLat(lng, lat, 2000);
      };
      latlngBtn.addEventListener('click', goCoord);
      const onEnter = (e) => { if (e.key === 'Enter') goCoord(); };
      latIn.addEventListener('keydown', onEnter);
      lngIn.addEventListener('keydown', onEnter);
      latlngBtn.dataset.wired = '1';
    }
```

- [ ] **Step 3: 배선 확인**

Run: `rg -n "fly-lat|fly-lng|fly-latlng-btn|goCoord" frontend/public/legacy-map/cesium-app.js`
Expected: `fly-lat`, `fly-lng`, `fly-latlng-btn`, `goCoord` 매칭(각 1회 이상). `latlngBtn.dataset.wired` 존재.

- [ ] **Step 4: 빌드 검증**

Run: `cd frontend && npm run build`
Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/legacy-map/cesium-app.js
git commit -m "feat(legacy-map): 위/경도 직접 입력 셀 이벤트 배선"
```

---

## Task 4: 수동 스모크 검증

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 앱 구동**

백엔드(VWorld 키 설정 필요)와 프론트를 띄운다. 개발 모드 예시:

Run: `cd frontend && npm run dev`
그리고 백엔드가 `/api/vworld/*` 를 서빙 중인지 확인(프록시/배포 환경에 따름).
브라우저에서 `/map` 진입 → 3D 모드 진입 → 좌측 패널 "3D 전용" 섹션 노출 확인.

- [ ] **Step 2: 5개 시나리오 수동 확인**

브라우저 콘솔을 연 상태로:

1. 주소 입력칸에 `서울 강남구` → "이동" 클릭 → 강남구로 카메라 비행(VWorld tier).
2. 주소 입력칸에 `Tokyo` → "이동" → 도쿄로 비행(Ion 토큰 있으면 Ion, 없으면 OSM Nominatim 폴백). 콘솔에 폴백 `console.warn` 이 떠도 정상.
3. 주소 입력칸에 `37.5665, 126.978` → "이동" → 서울시청 부근으로 비행(parseLatLng).
4. 위도 `37.5665` / 경도 `126.978` 셀 입력 → "이동" → 동일 지점 비행.
5. 위도 `999` / 경도 `999` → "이동" → `위도(-90~90)와 경도(-180~180)…` alert.
6. 주소 입력칸에 `asdfqwer존재하지않는장소` → "이동" → `위치를 찾지 못했습니다…` alert.

Expected: 각 시나리오가 위 설명대로 동작. 콘솔에 **미처리(uncaught) 예외 없음**(폴백 `warn` 은 허용).

- [ ] **Step 3: Enter 키 동작 확인**

주소 칸과 위/경도 칸에서 값 입력 후 **Enter** → 버튼 클릭과 동일하게 이동하는지 확인.

- [ ] **Step 4: 정리 커밋(필요 시)**

검증 중 사소한 수정이 있었다면 커밋:

```bash
git add -A
git commit -m "fix(legacy-map): 3D 위치 검색 스모크 검증 보정"
```

검증만 했고 변경이 없으면 이 단계는 건너뛴다.

---

## 자가 점검 (Self-Review)

- **스펙 커버리지**: 설계서 §5.1(HTML=Task1, cesium-app.js helpers/flyToAddress=Task2, wireControls=Task3), §5.2 데이터 흐름(Task2 flyToAddress), §5.3 에러 처리(Task2 폴백 + Task3 검증 alert), §7 검증(Task4) — 모든 항목에 대응 태스크 존재. ✓
- **플레이스홀더 스캔**: TODO/TBD/"적절히 처리" 없음. 모든 코드 블록이 실제 코드. ✓
- **타입/식별자 일관성**: `flyToLngLat`, `flyToGeocodeDestination`, `parseLatLng`, `ionGeocode`, `osmGeocode`, `flyToAddress`, ID `fly-address`/`fly-btn`/`fly-lat`/`fly-lng`/`fly-latlng-btn` — Task 간 명칭 일치. Task3 의 `flyToLngLat` 는 Task2 에서 정의됨. ✓
- **백엔드 의존성**: `/api/vworld/address`, `window.VWORLD_KEY`, `window.CESIUM_ION_TOKEN` 모두 기존재(변경 불필요). ✓
