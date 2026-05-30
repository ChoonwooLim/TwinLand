# VWorld 건물 Phase 2 — 가상건물 시뮬레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** 3D 뷰에서 사용자가 폴리곤을 그려 층수·층고·투명도·건물명을 지정하면 가상의 입체 건물을 생성·표시하고 localStorage 에 저장/복원하는 시뮬레이션 기능.

**Architecture:** 신규 vanilla-JS 모듈 `virtual-building.js`. 자체 `ScreenSpaceEventHandler`(LEFT_CLICK)로 그리기 모드에서만 정점 추가. `window.VirtualBuilding.isDrawing()` 노출 → Phase 1 의 건축물정보 클릭 핸들러가 그리기 중 양보(이미 가드 구현됨). 데이터/백엔드 의존 없음(순수 클라이언트).

**Tech Stack:** CesiumJS(전역 `Cesium`), `window._cesiumViewer`, localStorage.

---

## 사전 메모
- 설계서 §3.3 가상건물. Phase 1 의 `vworld-buildings.js` 클릭 핸들러는 `window.VirtualBuilding.isDrawing()` 를 이미 확인하므로, 이 모듈이 `isDrawing` 을 노출하면 충돌 없음.
- `window._cesiumViewer` 로 viewer 접근(3D 진입 후 set). 모듈은 준비 폴링.
- TDD 예외: legacy-map 정적 vanilla-JS → 편집 → `node --check` → 수동 스모크 → 커밋.

---

## Task 1: index.html — 가상건물 패널 + 스크립트

**Files:** Modify `frontend/public/legacy-map/index.html`

- [ ] **Step 1: `#group-parcel-style` 앞에 패널 삽입**

`<div class="filter-group" id="group-parcel-style">` 줄을 찾아 그 **앞**에 삽입:

```html
        <div class="filter-group" id="group-virtual-building">
          <strong>가상건물 (시뮬레이션)</strong>
          <div style="display:flex;gap:4px;margin-top:6px;align-items:center;">
            <label style="font-size:11px;white-space:nowrap;">층수</label>
            <input type="number" id="vb-floors" value="5" min="1" style="width:48px;padding:3px;font-size:12px;" />
            <label style="font-size:11px;white-space:nowrap;">층고(m)</label>
            <input type="number" id="vb-floor-h" value="3.3" step="0.1" min="1" style="width:52px;padding:3px;font-size:12px;" />
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;align-items:center;">
            <label style="font-size:11px;white-space:nowrap;">투명도</label>
            <input type="number" id="vb-alpha" value="60" min="0" max="100" style="width:48px;padding:3px;font-size:12px;" />
            <input type="text" id="vb-name" placeholder="건물명" style="flex:1;min-width:0;padding:3px;font-size:12px;" />
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            <button id="vb-draw" style="flex:1;padding:4px;background:#1a237e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;">건물그리기</button>
            <button id="vb-save" style="padding:4px 8px;background:#2e7d32;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;">저장</button>
            <button id="vb-clear" style="padding:4px 8px;background:#757575;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;">전체삭제</button>
          </div>
        </div>
```

- [ ] **Step 2: 스크립트 로드 추가** — `<script src="vworld-buildings.js"></script>` 다음 줄에:

```html
  <script src="virtual-building.js"></script>
```

- [ ] **Step 3: 확인** — Run: `rg -n "group-virtual-building|vb-draw|virtual-building.js" frontend/public/legacy-map/index.html` → 패널·버튼·스크립트 매칭.

- [ ] **Step 4: 커밋**
```bash
git add frontend/public/legacy-map/index.html
git commit -m "feat(legacy-map): 가상건물 패널 + virtual-building.js 로드"
```

---

## Task 2: virtual-building.js

**Files:** Create `frontend/public/legacy-map/virtual-building.js`

- [ ] **Step 1: 모듈 생성**

```javascript
// 가상건물 시뮬레이션 — 폴리곤 그리기 → 층수×층고 압출, localStorage 저장/복원
window.VirtualBuilding = (function () {
  let drawing = false;
  let drawPositions = [];   // [{lng,lat}]
  let previewEntity = null;
  let pointEntities = [];
  const saved = [];         // {positions:[[lng,lat]], floors, floorH, alpha, name}
  let savedEntities = [];
  let drawHandler = null;

  function viewer() { return window._cesiumViewer || null; }
  function isDrawing() { return drawing; }
  function num(id, dflt) { const el = document.getElementById(id); const n = parseFloat(el && el.value); return isFinite(n) ? n : dflt; }
  function str(id) { const el = document.getElementById(id); return ((el && el.value) || '').trim(); }

  function clearPreview() {
    const v = viewer(); if (!v) return;
    if (previewEntity) { v.entities.remove(previewEntity); previewEntity = null; }
    pointEntities.forEach(function (e) { v.entities.remove(e); }); pointEntities = [];
  }

  function addVertex(lng, lat) {
    const v = viewer();
    drawPositions.push({ lng: lng, lat: lat });
    pointEntities.push(v.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: { pixelSize: 8, color: Cesium.Color.YELLOW, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    }));
    if (drawPositions.length >= 2) {
      const positions = drawPositions.map(function (p) { return Cesium.Cartesian3.fromDegrees(p.lng, p.lat); });
      if (previewEntity) v.entities.remove(previewEntity);
      previewEntity = v.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.CYAN.withAlpha(0.3),
          outline: true, outlineColor: Cesium.Color.CYAN,
        },
      });
    }
    v.scene.requestRender();
  }

  function placeBuilding(b) {
    const v = viewer(); if (!v) return;
    const positions = b.positions.map(function (p) { return Cesium.Cartesian3.fromDegrees(p[0], p[1]); });
    const ent = v.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        height: 0,
        extrudedHeight: b.floors * b.floorH,
        material: Cesium.Color.fromCssColorString('#ff7043').withAlpha(b.alpha),
        outline: true, outlineColor: Cesium.Color.fromCssColorString('#bf360c'),
      },
      label: {
        text: b.name + ' (' + b.floors + '층)', font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE, showBackground: true,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    savedEntities.push(ent);
  }

  function startDraw() {
    const v = viewer();
    if (!v) { alert('3D 모드에서 사용하세요.'); return; }
    drawing = true; drawPositions = []; clearPreview();
    const btn = document.getElementById('vb-draw'); if (btn) btn.textContent = '완료(폴리곤 닫기)';
    if (!drawHandler) {
      drawHandler = new Cesium.ScreenSpaceEventHandler(v.scene.canvas);
      drawHandler.setInputAction(function (click) {
        if (!drawing) return;
        let cart = v.scene.pickPosition(click.position);
        if (!Cesium.defined(cart)) cart = v.camera.pickEllipsoid(click.position, v.scene.globe.ellipsoid);
        if (!Cesium.defined(cart)) return;
        const c = Cesium.Cartographic.fromCartesian(cart);
        addVertex(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude));
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
  }

  function finishDraw() {
    const v = viewer();
    if (drawPositions.length < 3) { alert('최소 3점을 찍으세요.'); return; }
    const b = {
      positions: drawPositions.map(function (p) { return [p.lng, p.lat]; }),
      floors: num('vb-floors', 5), floorH: num('vb-floor-h', 3.3),
      alpha: Math.min(1, Math.max(0, num('vb-alpha', 60) / 100)),
      name: str('vb-name') || '가상건물',
    };
    saved.push(b); placeBuilding(b);
    drawing = false; drawPositions = []; clearPreview();
    const btn = document.getElementById('vb-draw'); if (btn) btn.textContent = '건물그리기';
    if (v) v.scene.requestRender();
  }

  function toggleDraw() { if (drawing) finishDraw(); else startDraw(); }

  function save() {
    try { localStorage.setItem('twinland_virtual_buildings', JSON.stringify(saved)); alert('저장됨 (' + saved.length + '개)'); }
    catch (e) { alert('저장 실패: ' + e.message); }
  }

  function clearAll() {
    const v = viewer();
    savedEntities.forEach(function (e) { if (v) v.entities.remove(e); }); savedEntities = [];
    saved.length = 0;
    try { localStorage.removeItem('twinland_virtual_buildings'); } catch (e) {}
    if (v) v.scene.requestRender();
  }

  function loadSaved() {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('twinland_virtual_buildings') || '[]'); } catch (e) {}
    arr.forEach(function (b) { saved.push(b); placeBuilding(b); });
  }

  function wire() {
    const d = document.getElementById('vb-draw'); if (d && !d.dataset.wired) { d.addEventListener('click', toggleDraw); d.dataset.wired = '1'; }
    const s = document.getElementById('vb-save'); if (s && !s.dataset.wired) { s.addEventListener('click', save); s.dataset.wired = '1'; }
    const c = document.getElementById('vb-clear'); if (c && !c.dataset.wired) { c.addEventListener('click', clearAll); c.dataset.wired = '1'; }
    (function whenReady() {
      if (viewer()) { loadSaved(); return; }
      const t = setInterval(function () { if (viewer()) { clearInterval(t); loadSaved(); } }, 300);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  return { isDrawing: isDrawing, _finish: finishDraw, _start: startDraw };
})();
```

- [ ] **Step 2: 구문 검증** — Run: `node --check frontend/public/legacy-map/virtual-building.js && echo OK` → `OK`

- [ ] **Step 3: 커밋**
```bash
git add frontend/public/legacy-map/virtual-building.js
git commit -m "feat(legacy-map): 가상건물 그리기·압출·localStorage 저장/복원"
```

---

## Task 3: 수동 스모크 검증

- [ ] **Step 1**: 3D 진입 → "가상건물" 패널 노출. 층수=10 입력.
- [ ] **Step 2**: "건물그리기" → 지도에 3점 이상 클릭(노란 점 + 청록 미리보기) → "완료" → 주황 입체 건물 + 라벨.
- [ ] **Step 3**: "저장" → alert. 새로고침 → 복원 확인. "전체삭제" → 사라짐.
- [ ] **Step 4**: 그리기 중 건물 클릭해도 건축물정보 팝업 안 뜸(isDrawing 가드). 콘솔 예외 없음.

---

## 자가 점검
- 스펙 §3.3 전 항목(그리기·층고/층수/투명도/명·저장·복원·삭제·클릭 가드) → Task 매핑. ✓
- 플레이스홀더 없음(실제 코드). ✓
- 식별자: `isDrawing`/`startDraw`/`finishDraw`/`placeBuilding`/`vb-draw|save|clear|floors|floor-h|alpha|name` 일치. Phase 1 가드 `window.VirtualBuilding.isDrawing()` 와 일치. ✓
