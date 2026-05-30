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
    if (on && !v) {
      alert('3D 모드에서 사용하세요.');
      const t = document.getElementById('toggle-vworld-3d');
      if (t) t.checked = false;
      return;
    }
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
