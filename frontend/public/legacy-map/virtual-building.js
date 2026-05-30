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

  function addVertex(lng, lat, h) {
    const v = viewer();
    const hh = h || 0;
    drawPositions.push({ lng: lng, lat: lat, h: hh });
    pointEntities.push(v.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, hh),
      point: { pixelSize: 8, color: Cesium.Color.YELLOW, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    }));
    if (drawPositions.length >= 2) {
      const positions = drawPositions.map(function (p) { return Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.h); });
      if (previewEntity) v.entities.remove(previewEntity);
      previewEntity = v.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          perPositionHeight: true,
          material: Cesium.Color.CYAN.withAlpha(0.3),
          outline: true, outlineColor: Cesium.Color.CYAN,
        },
      });
    }
    v.scene.requestRender();
  }

  function placeBuilding(b) {
    const v = viewer(); if (!v) return;
    const baseH = b.positions.reduce(function (m, p) { return Math.max(m, p[2] || 0); }, 0);
    const top = baseH + b.floors * b.floorH;
    const positions = b.positions.map(function (p) { return Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0); });
    const ent = v.entities.add({
      position: Cesium.Cartesian3.fromDegrees(b.positions[0][0], b.positions[0][1], top),
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        perPositionHeight: true,
        extrudedHeight: top,
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
        const ray = v.camera.getPickRay(click.position);
        let cart = ray && v.scene.globe.pick(ray, v.scene);
        if (!Cesium.defined(cart)) cart = v.camera.pickEllipsoid(click.position, v.scene.globe.ellipsoid);
        if (!Cesium.defined(cart)) return;
        const c = Cesium.Cartographic.fromCartesian(cart);
        addVertex(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), c.height || 0);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
  }

  function finishDraw() {
    const v = viewer();
    if (drawPositions.length < 3) { alert('최소 3점을 찍으세요.'); return; }
    const b = {
      positions: drawPositions.map(function (p) { return [p.lng, p.lat, p.h]; }),
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
