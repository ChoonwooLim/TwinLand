# VWorld 건물 Phase 1 — GIS 3D 건물 + 건축물정보 팝업 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TwinLand 3D(Cesium) 뷰에 VWorld GIS건물통합정보(`LT_C_SPBD`) 기반 3D 압출 건물 토글과, 건물/필지 클릭 시 건물·필지·토지특성을 합친 정보 팝업을 추가한다.

**Architecture:** `legacy-map` 정적 앱. `window._cesiumViewer`(cesium-app.js 가 노출)로 viewer 접근. 신규 vanilla-JS 모듈 2개(`map-popup.js`, `vworld-buildings.js`)를 `<script>` 로 추가하며, 모듈은 자체적으로 토글을 배선하고 `viewer` 준비를 폴링한 뒤 클릭 핸들러를 설치한다. 데이터는 기존 `/api/vworld/data`(GetFeature)·`/api/vworld/ned` 프록시만 사용(백엔드 무변경).

**Tech Stack:** CesiumJS 1.118(전역 `Cesium`), VWorld Data API(`LT_C_SPBD`, `LP_PA_CBND_BUBUN`), VWorld NED(`getLandCharacteristics`).

---

## 사전 메모 (구현 전 필독)

- **설계서**: [`docs/superpowers/specs/2026-05-30-vworld-building-features-design.md`](../specs/2026-05-30-vworld-building-features-design.md). 이 계획은 그 중 **Phase 1**(①②)만 다룬다. ③ 가상건물·④ 단지용도지역은 별도 계획.
- **viewer 접근**: cesium-app.js 가 `window._cesiumViewer = viewer`(약 100·116행) 로 노출. 3D 모드 진입 후 set 됨 → 모듈은 폴링.
- **VWorld 키**: `window.VWORLD_KEY` 주입됨(프록시가 서버에서 재강제하므로 값 자체는 형식상). `domain` 은 `window.location.hostname`.
- **확정된 `LT_C_SPBD` 속성**(라이브 probe): `buld_nm`(건물명), `gro_flo_co`(지상층수), `sido`·`sigungu`·`rd_nm`·`buld_no`(주소), `bd_mgt_sn`(건물관리번호), geometry=MultiPolygon.
- **필지**(`LP_PA_CBND_BUBUN`) 속성: `pnu`, `jibun`. NED `getLandCharacteristics` 파싱은 app.js:715-728 참고(`field[]` → `lastUpdtDt` 내림차순 → `ladUseSittnNm`/`prposArea1Nm`). 공시지가/면적 필드명은 **Task 4 에서 라이브 probe 로 확정**.
- **app.js 내부 헬퍼는 비공개**(`fetchLandCharacteristics`/`wfsQuery` 는 `window` 미노출) → 모듈에서 최소 fetch 를 **복제**(app.js 의존 금지).
- **TDD 예외(의도적)**: legacy-map 은 테스트 하니스 없는 정적 vanilla-JS. 각 태스크는 **편집 → `node --check` → 라이브 probe/수동 스모크 → 커밋**. 순수 로직(층고 계산 등)은 Node 로 단위 검증.
- 좌표는 항상 (lng, lat) 순. VWorld geomFilter 는 `POINT(lng lat)` / `BOX(w,s,e,n)`.

---

## Task 1: 재사용 팝업 컴포넌트 `map-popup.js`

**Files:**
- Create: `frontend/public/legacy-map/map-popup.js`

- [ ] **Step 1: 파일 생성**

```javascript
// 지도 정보 팝업 (재사용) — window.MapPopup.show(title, rowsHtml) / hide()
window.MapPopup = (function () {
  let el = null;
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'map-info-popup';
    el.style.cssText = 'position:absolute;top:120px;right:16px;z-index:1200;display:none;'
      + 'max-width:320px;background:#fff;color:#222;border:1px solid #ccc;border-radius:6px;'
      + 'box-shadow:0 2px 12px rgba(0,0,0,.25);font-size:13px;overflow:hidden;';
    document.body.appendChild(el);
    return el;
  }
  function show(title, rowsHtml) {
    const n = ensure();
    n.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;'
      + 'padding:8px 10px;background:#1a237e;color:#fff;">'
      + '<strong style="font-size:13px;">' + (title || '정보') + '</strong>'
      + '<span id="map-info-popup-x" style="cursor:pointer;padding:0 4px;">✕</span></div>'
      + '<div style="padding:8px 10px;">' + rowsHtml + '</div>';
    n.style.display = 'block';
    const x = document.getElementById('map-info-popup-x');
    if (x) x.onclick = hide;
  }
  function hide() { if (el) el.style.display = 'none'; }
  function rows(pairs) {
    return pairs.filter(Boolean).map(function (kv) {
      return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #f0f0f0;">'
        + '<span style="color:#789;min-width:92px;flex:none;">' + kv[0] + '</span>'
        + '<span>' + kv[1] + '</span></div>';
    }).join('');
  }
  return { show, hide, rows };
})();
```

- [ ] **Step 2: 구문 검증**

Run: `node --check frontend/public/legacy-map/map-popup.js`
Expected: 출력 없음(성공). 이어 `echo OK`.

- [ ] **Step 3: 커밋**

```bash
git add frontend/public/legacy-map/map-popup.js
git commit -m "feat(legacy-map): 재사용 지도 팝업 컴포넌트 MapPopup 추가"
```

---

## Task 2: index.html — 3D 건물 토글 + 스크립트 로드

**Files:**
- Modify: `frontend/public/legacy-map/index.html` (`#group-3d-only` 체크박스 영역, `<script>` 로드 영역 367행 부근)

- [ ] **Step 1: 3D 전용 패널에 토글 추가**

`#group-3d-only` 안의 OSM 박스 건물 체크박스 줄(아래) 을 찾는다:

```html
          <label><input type="checkbox" id="toggle-osm-buildings" /> OSM 박스 건물 (전역)</label>
```

바로 다음 줄에 추가한다:

```html
          <label><input type="checkbox" id="toggle-vworld-3d" /> VWorld 건물 (입체·국내)</label>
```

- [ ] **Step 2: 스크립트 로드 추가**

`landinfo.js` 로드 줄(367행 부근) 을 찾는다:

```html
  <script src="landinfo.js"></script>
```

그 **다음** 에 추가한다(cesium-app.js 보다 뒤여야 `window._cesiumViewer` 사용 가능):

```html
  <script src="map-popup.js"></script>
  <script src="vworld-buildings.js"></script>
```

- [ ] **Step 3: 확인**

Run: `rg -n "toggle-vworld-3d|map-popup.js|vworld-buildings.js" frontend/public/legacy-map/index.html`
Expected: 토글 1줄 + 스크립트 2줄 매칭.

- [ ] **Step 4: 커밋**

```bash
git add frontend/public/legacy-map/index.html
git commit -m "feat(legacy-map): VWorld 3D 건물 토글 + 신규 모듈 스크립트 로드"
```

---

## Task 3: `vworld-buildings.js` — 3D 압출 건물 토글

**Files:**
- Create: `frontend/public/legacy-map/vworld-buildings.js`

- [ ] **Step 1: 층고 계산 순수 로직 단위 검증(먼저)**

임시 검증 스크립트로 압출 높이 규칙을 고정한다.

Run:
```bash
node -e "const h=(f)=>(parseInt(f,10)||1)*3.3; console.log(h('4')===13.2, h('')===3.3, h('25')===82.5)"
```
Expected: `true true true`

- [ ] **Step 2: 모듈 생성 (토글 + bbox 로드 + 압출)**

```javascript
// VWorld GIS건물통합정보(LT_C_SPBD) 3D 압출 + 건물/필지/토지특성 클릭 조회
window.VworldBuildings = (function () {
  const FLOOR_H = 3.3;     // 층당 높이(m)
  const LOAD_ALT = 2000;   // 이 카메라 고도(m) 이하에서만 로드
  let entities = [];
  let enabled = false;
  let clickHandler = null;
  let moveTimer = null;
  const bboxCache = new Map();

  function viewer() { return window._cesiumViewer || null; }
  function vkey() { return (window.VWORLD_KEY || '').trim(); }
  function domain() { return window.location.hostname || 'localhost'; }

  async function getFeature(layer, geomFilter, size) {
    const url = '/api/vworld/data?' + new URLSearchParams({
      service: 'data', version: '2.0', request: 'GetFeature', format: 'json',
      crs: 'EPSG:4326', size: String(size || 1000), geometry: 'true', attribute: 'true',
      data: layer, geomFilter: geomFilter, key: vkey(), domain: domain(),
    });
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j && j.response && j.response.result
      && j.response.result.featureCollection
      && j.response.result.featureCollection.features) || [];
  }

  function viewBBoxStr() {
    const v = viewer(); if (!v) return null;
    const rect = v.camera.computeViewRectangle();
    if (!rect) return null;
    const w = Cesium.Math.toDegrees(rect.west), s = Cesium.Math.toDegrees(rect.south);
    const e = Cesium.Math.toDegrees(rect.east), n = Cesium.Math.toDegrees(rect.north);
    return 'BOX(' + w + ',' + s + ',' + e + ',' + n + ')';
  }

  function altitude() {
    const v = viewer(); if (!v) return Infinity;
    return v.camera.positionCartographic.height;
  }

  function clearEntities() {
    const v = viewer(); if (!v) return;
    entities.forEach(function (ent) { v.entities.remove(ent); });
    entities = [];
  }

  function addBuilding(f) {
    const v = viewer();
    const floors = parseInt(f.properties && f.properties.gro_flo_co, 10) || 1;
    const extruded = floors * FLOOR_H;
    const g = f.geometry; if (!g) return;
    const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    polys.forEach(function (poly) {
      const ring = poly[0];
      const positions = ring.map(function (c) { return Cesium.Cartesian3.fromDegrees(c[0], c[1]); });
      const ent = v.entities.add({
        polygon: {
          hierarchy: positions,
          height: 0,
          extrudedHeight: extruded,
          material: Cesium.Color.fromCssColorString('#90a4ae').withAlpha(0.85),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#37474f'),
        },
      });
      entities.push(ent);
    });
  }

  async function loadVisible() {
    const v = viewer(); if (!v || !enabled) return;
    if (altitude() > LOAD_ALT) { clearEntities(); v.scene.requestRender(); return; }
    const key = viewBBoxStr(); if (!key) return;
    let feats = bboxCache.get(key);
    if (!feats) {
      try { feats = await getFeature('LT_C_SPBD', key, 1000); }
      catch (e) { console.warn('[VworldBuildings] 로드 실패:', e.message); return; }
      bboxCache.set(key, feats);
    }
    clearEntities();
    feats.forEach(addBuilding);
    v.scene.requestRender();
  }

  function toggle(on) {
    const v = viewer();
    if (on && !v) { alert('3D 모드에서 사용하세요.'); var t = document.getElementById('toggle-vworld-3d'); if (t) t.checked = false; return; }
    enabled = !!on;
    if (enabled) loadVisible();
    else { clearEntities(); if (v) v.scene.requestRender(); }
  }

  // --- 클릭 조회/카메라 새로고침/배선은 Task 4 에서 추가 ---

  function wire() {
    const t = document.getElementById('toggle-vworld-3d');
    if (t && !t.dataset.wired) {
      t.addEventListener('change', function (e) { toggle(e.target.checked); });
      t.dataset.wired = '1';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  return { toggle: toggle, _getFeature: getFeature, _loadVisible: loadVisible };
})();
```

- [ ] **Step 3: 구문 검증**

Run: `node --check frontend/public/legacy-map/vworld-buildings.js && echo OK`
Expected: `OK`

- [ ] **Step 4: 라이브 bbox 응답 확인(선택, 회귀 방지)**

Run:
```bash
node -e "fetch('https://twinland.twinverse.org/api/vworld/data?service=data&version=2.0&request=GetFeature&format=json&crs=EPSG:4326&size=5&geometry=true&attribute=true&data=LT_C_SPBD&geomFilter='+encodeURIComponent('BOX(127.0768,37.4931,127.0788,37.4951)')).then(r=>r.json()).then(j=>console.log('features=',j.response.result.featureCollection.features.length))"
```
Expected: `features= 3` 부근(0 보다 큼).

- [ ] **Step 5: 커밋**

```bash
git add frontend/public/legacy-map/vworld-buildings.js
git commit -m "feat(legacy-map): VWorld LT_C_SPBD 3D 압출 건물 토글"
```

---

## Task 4: `vworld-buildings.js` — 클릭 → 건물·필지·토지특성 팝업

**Files:**
- Modify: `frontend/public/legacy-map/vworld-buildings.js` (Task 3 모듈 내 "Task 4 에서 추가" 주석 위치)

- [ ] **Step 1: NED 공시지가/면적 필드명 라이브 확정**

`getLandCharacteristics` 응답의 정확한 필드명을 먼저 확인한다(추측 금지). 강남 개포동 PNU 예시:

```bash
node -e "fetch('https://twinland.twinverse.org/api/vworld/ned/getLandCharacteristics?'+new URLSearchParams({pnu:'1168010300100140002',format:'json',domain:'twinland.twinverse.org'})).then(r=>r.json()).then(j=>{const f=(j.landCharacteristicss&&j.landCharacteristicss.field)||(j.response&&j.response.fields&&j.response.fields.field);console.log(JSON.stringify(Array.isArray(f)?f[0]:f))})"
```
관찰: `pblntfPclnd`(공시지가), `lndpclAr`(면적), `lndcgrCodeNm`(지목), `ladUseSittnNm`(토지이용상황) 등의 **실제 키**를 확인하고, 다르면 Step 2 코드의 키를 맞춰 수정한다.

- [ ] **Step 2: 클릭 핸들러 + 통합 조회 추가**

`vworld-buildings.js` 의 `// --- 클릭 조회/카메라 새로고침/배선은 Task 4 에서 추가 ---` 주석을 아래로 교체한다:

```javascript
  // 건물(LT_C_SPBD)+필지(LP_PA_CBND_BUBUN)+토지특성(NED) 통합 조회 → 팝업
  async function queryInfoAt(lng, lat) {
    const pt = 'POINT(' + lng + ' ' + lat + ')';
    let bld = null, parcel = null;
    try { bld = (await getFeature('LT_C_SPBD', pt, 1))[0] || null; } catch (e) {}
    try { parcel = (await getFeature('LP_PA_CBND_BUBUN', pt, 1))[0] || null; } catch (e) {}

    const pairs = [];
    let title = '필지정보';
    if (bld && bld.properties) {
      const p = bld.properties;
      const addr = [p.sido, p.sigungu, p.rd_nm, p.buld_no].filter(Boolean).join(' ');
      title = p.buld_nm || '건물정보';
      pairs.push(['건물명', p.buld_nm || '-']);
      if (addr) pairs.push(['주소', addr]);
      pairs.push(['지상층수', (p.gro_flo_co || '-') + '층']);
      if (p.bd_mgt_sn) pairs.push(['건물관리번호', p.bd_mgt_sn]);
    }
    const pnu = parcel && parcel.properties && parcel.properties.pnu;
    if (parcel && parcel.properties) {
      if (parcel.properties.jibun) pairs.push(['지번', parcel.properties.jibun]);
    }
    if (pnu) {
      try {
        const url = '/api/vworld/ned/getLandCharacteristics?' + new URLSearchParams({
          key: vkey(), pnu: pnu, format: 'json', domain: domain(),
        });
        const d = await (await fetch(url)).json();
        const root = (d && d.landCharacteristicss) || (d && d.response);
        let field = (root && root.field) || (root && root.fields && root.fields.field) || [];
        const arr = Array.isArray(field) ? field : [field];
        arr.sort(function (a, b) { return String(b.lastUpdtDt || '').localeCompare(String(a.lastUpdtDt || '')); });
        const rec = arr[0];
        if (rec) {
          // 필드명은 Step 1 라이브 확인값과 일치해야 함
          if (rec.lndcgrCodeNm) pairs.push(['지목', rec.lndcgrCodeNm]);
          if (rec.ladUseSittnNm || rec.prposArea1Nm) pairs.push(['토지이용', rec.ladUseSittnNm || rec.prposArea1Nm]);
          if (rec.pblntfPclnd) pairs.push(['공시지가', Number(rec.pblntfPclnd).toLocaleString() + '원/㎡']);
          if (rec.lndpclAr) pairs.push(['면적', rec.lndpclAr + '㎡']);
        }
      } catch (e) { console.warn('[VworldBuildings] NED 실패:', e.message); }
    }

    if (!pairs.length) { window.MapPopup.hide(); return; }
    window.MapPopup.show(title, window.MapPopup.rows(pairs));
  }

  function installClick() {
    const v = viewer(); if (!v || clickHandler) return;
    clickHandler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas);
    clickHandler.setInputAction(function (click) {
      // 가상건물 그리기 모드(Phase 2)면 양보
      if (window.VirtualBuilding && window.VirtualBuilding.isDrawing && window.VirtualBuilding.isDrawing()) return;
      let cart = v.scene.pickPosition(click.position);
      if (!Cesium.defined(cart)) cart = v.camera.pickEllipsoid(click.position, v.scene.globe.ellipsoid);
      if (!Cesium.defined(cart)) return;
      const c = Cesium.Cartographic.fromCartesian(cart);
      queryInfoAt(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function installCameraRefresh() {
    const v = viewer(); if (!v) return;
    v.camera.changed.addEventListener(function () {
      if (!enabled) return;
      clearTimeout(moveTimer);
      moveTimer = setTimeout(loadVisible, 400);
    });
  }

  // viewer 준비될 때까지 폴링 후 클릭/카메라 부착
  (function whenReady() {
    if (viewer()) { installClick(); installCameraRefresh(); return; }
    const t = setInterval(function () {
      if (viewer()) { clearInterval(t); installClick(); installCameraRefresh(); }
    }, 300);
  })();
```

그리고 모듈 `return` 객체에 `queryInfoAt` 를 노출하도록 수정:

```javascript
  return { toggle: toggle, queryInfoAt: queryInfoAt, _getFeature: getFeature, _loadVisible: loadVisible };
```

- [ ] **Step 3: 구문 검증**

Run: `node --check frontend/public/legacy-map/vworld-buildings.js && echo OK`
Expected: `OK`

- [ ] **Step 4: 커밋**

```bash
git add frontend/public/legacy-map/vworld-buildings.js
git commit -m "feat(legacy-map): 건물/필지/토지특성 통합 클릭 팝업 + 카메라 새로고침"
```

---

## Task 5: 수동 스모크 검증

**Files:** (없음 — 검증)

- [ ] **Step 1: 구동 + 3D 진입**

`npm run dev`(또는 배포본). `/map` → **3D** 토글 → 좌측 "3D 전용" 패널에 "VWorld 건물 (입체·국내)" 체크박스 노출 확인.

- [ ] **Step 2: 3D 건물 토글**

서울 등 도심으로 이동(고도 < 2km) → 토글 ON → 회색 입체 건물 다수 표시. 토글 OFF → 사라짐. 멀리 줌아웃(>2km) → 건물 로드 보류(과부하 없음). 콘솔 미처리 예외 없음.

- [ ] **Step 3: 건물/필지 클릭 팝업**

건물(또는 지면) 클릭 → 우상단 팝업: 건물명·주소·지상층수·건물관리번호(건물 있을 때) + 지번·토지이용·공시지가(필지/NED). 나대지 클릭 → 필지/토지특성만. 닫기(✕) 동작.

- [ ] **Step 4: (변경 있었으면) 커밋**

검증 중 보정이 있었다면 `git add -A && git commit -m "fix(legacy-map): Phase 1 스모크 보정"`. 없으면 건너뜀.

---

## 자가 점검 (Self-Review)

- **스펙 커버리지**: §3.1 3D 건물=Task3, §3.2 팝업=Task1+Task4, 모듈분리(§4)=map-popup.js/vworld-buildings.js, 클릭 디스패처 단일화=installClick(가상건물 양보 가드 포함). ③④ 는 범위 외(다음 계획). ✓
- **플레이스홀더 스캔**: NED 필드명만 Task4 Step1 라이브 확정으로 처리(추측 금지 명시), 그 외 실제 코드. ✓
- **식별자 일관성**: `getFeature`/`viewer`/`enabled`/`entities`/`queryInfoAt`/`toggle`/`installClick`/`loadVisible`/`MapPopup.show|hide|rows`/토글 id `toggle-vworld-3d` — Task 간 일치. ✓
- **백엔드 의존성**: `/api/vworld/data`·`/api/vworld/ned`·`window.VWORLD_KEY`·`window._cesiumViewer` 모두 기존재. ✓
