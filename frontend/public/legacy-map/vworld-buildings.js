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

  function wire() {
    const t = document.getElementById('toggle-vworld-3d');
    if (t && !t.dataset.wired) {
      t.addEventListener('change', function (e) { toggle(e.target.checked); });
      t.dataset.wired = '1';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  return { toggle: toggle, queryInfoAt: queryInfoAt, _getFeature: getFeature, _loadVisible: loadVisible };
})();
