// JooJoo Land - 3D 뷰어 (Cesium)
// 2D 에서 로드한 필지 GeoJSON 을 3D 로 재사용

window.CesiumApp = (function () {
  let viewer = null;
  let initialized = false;
  let entitiesByNo = {};
  let googleTileset = null;
  let osmBuildings = null;
  const allParcelGroups = [];  // { parcel, ringCoords, terrainHeights, top, wall }
  const labelEntities = [];
  let labelsVisible = true;

  // 필지 스타일 기본값 (프로젝트에서 불러온 값이 있으면 병합)
  const defaultStyle = {
    height: 8,
    alpha: 0.55,
    fill: true,
    outline: true,
    outlineWidth: 2,
    uniform: false,
    uniformColor: '#9c27b0',
    colors: Object.assign({}, window.CATEGORY_COLORS || {
      '전': '#f9a825', '답': '#1976d2', '임': '#00e676',
      '임야': '#e91e63', '대': '#ffeb3b',
    }),
  };
  let storedStyle = null;
  try {
    const raw = localStorage.getItem('joojoo_style');
    storedStyle = raw ? JSON.parse(raw) : null;
  } catch (e) {}
  const style = Object.assign({}, defaultStyle, storedStyle || {});
  style.colors = Object.assign({}, defaultStyle.colors, (storedStyle && storedStyle.colors) || {});

  // 2D 에서 성공한 필지 feature 를 저장해두기 위한 수집 함수
  const collected = {};
  function register(parcel, feature) {
    collected[parcel.no] = { parcel, feature };
    // init 이 이미 끝난 상태면 즉시 추가
    if (viewer && !entitiesByNo[parcel.no]) {
      addParcel(parcel, feature);
    }
  }

  function getFlyBounds() {
    const lats = [], lngs = [];
    Object.values(collected).forEach(({ feature }) => {
      const coords = extractCoords(feature.geometry);
      coords.forEach(([lng, lat]) => { lngs.push(lng); lats.push(lat); });
    });
    if (lats.length === 0) return null;
    return {
      west:  Math.min(...lngs), east:  Math.max(...lngs),
      south: Math.min(...lats), north: Math.max(...lats),
    };
  }

  function extractCoords(geom) {
    // GeoJSON geometry → flat [[lng,lat], ...]
    const out = [];
    const walk = (arr) => {
      if (typeof arr[0] === 'number') out.push(arr);
      else arr.forEach(walk);
    };
    if (geom && geom.coordinates) walk(geom.coordinates);
    return out;
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    // Cesium Ion 토큰 설정 (있으면 실제 지형, 없으면 평면)
    if (window.CESIUM_ION_TOKEN) {
      Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN;
    }

    // VWorld WMTS 위성 imagery
    const vworldImagery = new Cesium.UrlTemplateImageryProvider({
      url: `https://api.vworld.kr/req/wmts/1.0.0/${window.VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`,
      maximumLevel: 19,
      credit: 'VWorld',
    });

    // 지형: Ion 토큰 있으면 World Terrain, 없으면 평면
    let terrainProvider;
    if (window.CESIUM_ION_TOKEN) {
      try {
        terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
      } catch (e) {
        console.warn('[Cesium] World Terrain 로드 실패, 평면으로 fallback:', e.message);
        terrainProvider = new Cesium.EllipsoidTerrainProvider();
      }
    } else {
      console.info('[Cesium] Ion 토큰 없음 → 평면 지구');
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    window._cesiumViewer = null;
    viewer = new Cesium.Viewer('cesium-container', {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(Promise.resolve(vworldImagery)),
      terrainProvider,
    });

    window._cesiumViewer = viewer;
    // 배경색·분위기 (폴리곤 가시성 위해 depthTest 비활성)
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0b1020');

    // 필지 폴리곤 추가 — 지형 샘플링이 끝날 때까지 기다렸다가 카메라 이동
    await Promise.all(
      Object.values(collected).map(({ parcel, feature }) => addParcel(parcel, feature))
    );

    // 2D 에서 이미 켜져있던 인접 레이어들 drained 렌더
    flushPendingAdjLayers();

    // 카메라: 필지 엔티티 묶음에 맞춰 Cesium 이 자동으로 거리 계산
    const tops = allParcelGroups.map(g => g.top).filter(Boolean);
    if (tops.length > 0) {
      viewer.flyTo(tops, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-45),
          0  // range=0 → Cesium 이 bounding sphere 에 맞게 자동 계산
        ),
      });
    }
  }

  async function addParcel(parcel, feature) {
    const polygons = normalizePolygons(feature.geometry);

    for (let idx = 0; idx < polygons.length; idx++) {
      const ringCoords = polygons[idx];
      // 정점별 지형 고도 샘플링 → 경사 지형에서도 표면에 밀착
      const carto = ringCoords.map(([lng, lat]) => Cesium.Cartographic.fromDegrees(lng, lat));
      let terrainHeights = ringCoords.map(() => 0);
      try {
        const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, carto);
        terrainHeights = sampled.map(c => (typeof c.height === 'number' && !isNaN(c.height)) ? c.height : 0);
      } catch (e) {
        console.warn('[Cesium] terrain sampling 실패:', e.message);
      }

      const group = buildParcelGroup(parcel, ringCoords, terrainHeights);
      allParcelGroups.push(group);
      if (idx === 0) entitiesByNo[parcel.no] = group.top;
    }

    // 지번 라벨 (지형 표면에 밀착)
    const center = polygonCentroid(polygons[0]);
    if (center) {
      const labelEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(center[0], center[1]),
        show: labelsVisible,
        label: {
          text: parcel.lot,
          font: 'bold 13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 5000, 0.6),
        },
      });
      labelEntities.push(labelEntity);
    }
  }

  function toggleLabels(on) {
    labelsVisible = !!on;
    labelEntities.forEach(e => { e.show = labelsVisible; });
    if (viewer) viewer.scene.requestRender();
  }

  // ========== 인접 레이어 (도로·구거·하천 등) 3D 렌더링 ==========
  // 2D Leaflet 에서 쓰던 GeoJSON 을 받아 Cesium 에서 지형에 드레이프되는
  // classification 폴리곤으로 그린다.
  // 2D 호출 순서가 init() 보다 앞설 수 있으므로 pending 큐로 지연 렌더.
  const adjEntities = {};                // type -> [Cesium.Entity ...]
  const adjPending = {};                  // type -> { features, cfg } (viewer 없을 때 저장)

  function materialFor(cfg) {
    const baseColor = Cesium.Color.fromCssColorString(cfg.color || '#888888');
    const alpha = typeof cfg.fillOpacity === 'number' ? cfg.fillOpacity : 0.4;
    return { baseColor, fillColor: baseColor.withAlpha(alpha) };
  }

  function renderAdjFeatures(type, features, cfg) {
    const { baseColor, fillColor } = materialFor(cfg);
    const list = [];
    features.forEach(f => {
      const polygons = normalizePolygons(f.geometry);
      polygons.forEach(ring => {
        if (!ring || ring.length < 3) return;
        const positions = Cesium.Cartesian3.fromDegreesArray(
          ring.flatMap(([lng, lat]) => [lng, lat])
        );
        const entity = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: fillColor,
            classificationType: Cesium.ClassificationType.TERRAIN,
          },
        });
        entity._adjType = type;
        list.push(entity);
      });
    });
    adjEntities[type] = list;
    viewer.scene.requestRender();
  }

  function setAdjacentLayer(type, features, cfg) {
    clearAdjacentLayer(type);
    if (!features || features.length === 0) return;
    if (!viewer) {
      adjPending[type] = { features, cfg };
      return;
    }
    renderAdjFeatures(type, features, cfg);
  }

  function clearAdjacentLayer(type) {
    delete adjPending[type];
    const list = adjEntities[type];
    if (!list) return;
    if (viewer) {
      list.forEach(e => viewer.entities.remove(e));
      viewer.scene.requestRender();
    }
    delete adjEntities[type];
  }

  function restyleAdjacentLayer(type, cfg) {
    if (adjPending[type]) adjPending[type].cfg = cfg;
    const list = adjEntities[type];
    if (!list || !viewer) return;
    const { fillColor } = materialFor(cfg);
    list.forEach(e => {
      if (e.polygon) e.polygon.material = fillColor;
    });
    viewer.scene.requestRender();
  }

  function flushPendingAdjLayers() {
    Object.entries(adjPending).forEach(([type, { features, cfg }]) => {
      if (features && features.length > 0) renderAdjFeatures(type, features, cfg);
    });
    Object.keys(adjPending).forEach(k => delete adjPending[k]);
  }

  function topPositionsFor(ringCoords, terrainHeights, extraHeight) {
    const lift = extraHeight > 0 ? extraHeight : 0.5;  // 바닥 드레이프 시 살짝 띄움
    const flat = [];
    ringCoords.forEach(([lng, lat], i) => {
      flat.push(lng, lat, (terrainHeights[i] || 0) + lift);
    });
    return Cesium.Cartesian3.fromDegreesArrayHeights(flat);
  }

  function buildParcelGroup(parcel, ringCoords, terrainHeights) {
    const baseHex = style.uniform ? (style.uniformColor || '#9e9e9e') : (style.colors[parcel.category] || '#9e9e9e');
    const fillColor = Cesium.Color.fromCssColorString(baseHex).withAlpha(style.alpha);
    const outlineColor = Cesium.Color.fromCssColorString(baseHex);
    const h = Math.max(style.height, 0);

    const top = viewer.entities.add({
      name: `${parcel.location} ${parcel.lot}`,
      polygon: {
        hierarchy: topPositionsFor(ringCoords, terrainHeights, h),
        material: fillColor,
        fill: style.fill,
        perPositionHeight: true,
        outline: style.outline,
        outlineColor: outlineColor,
        outlineWidth: style.outlineWidth,
      },
      description: buildPopup(parcel),
    });

    let wall = null;
    if (h > 0) {
      wall = viewer.entities.add({
        wall: {
          positions: Cesium.Cartesian3.fromDegreesArray(ringCoords.flatMap(([lng, lat]) => [lng, lat])),
          minimumHeights: terrainHeights.slice(),
          maximumHeights: terrainHeights.map(t => t + h),
          material: fillColor,
          fill: style.fill,
          outline: style.outline,
          outlineColor: outlineColor,
          outlineWidth: style.outlineWidth,
        },
      });
    }

    return { parcel, ringCoords, terrainHeights, top, wall };
  }

  function normalizePolygons(geom) {
    if (!geom) return [];
    if (geom.type === 'Polygon') return [geom.coordinates[0]];         // outer ring
    if (geom.type === 'MultiPolygon') return geom.coordinates.map(p => p[0]);
    return [];
  }

  function polygonCentroid(ring) {
    if (!ring || ring.length === 0) return null;
    let lng = 0, lat = 0;
    ring.forEach(([x, y]) => { lng += x; lat += y; });
    return [lng / ring.length, lat / ring.length];
  }

  function buildPopup(parcel) {
    return `
      <div style="font-weight:700;font-size:15px;color:#1a237e;margin-bottom:4px">${parcel.location} ${parcel.lot}</div>
      <div>지목: ${parcel.category}</div>
      <div>면적: ${parcel.area_m2.toLocaleString()}㎡ (${parcel.area_pyeong.toLocaleString()}평)</div>
      <div>소유자: ${parcel.owner} (${parcel.memo})</div>
    `;
  }

  async function show() {
    document.getElementById('map').style.display = 'none';
    document.getElementById('cesium-container').classList.add('active');
    document.body.classList.add('mode-3d');
    if (!initialized) {
      await init();
      wireControls();
    } else {
      viewer.resize();
    }
    // 2D 로드 중 뒤늦게 도착한 필지까지 포함해서 카메라 재프레임
    await frameAllParcels();
  }

  async function frameAllParcels() {
    if (!viewer) return;
    const tops = allParcelGroups.map(g => g.top).filter(Boolean);
    if (tops.length === 0) return;
    viewer.flyTo(tops, {
      duration: 1.2,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0),
    });
  }

  function applyStyle(patch) {
    Object.assign(style, patch || {});
    if (patch && patch.colors) Object.assign(style.colors, patch.colors);
    try { localStorage.setItem('joojoo_style', JSON.stringify(style)); } catch (e) {}
    if (!viewer) return;
    const h = Math.max(style.height, 0);
    allParcelGroups.forEach((g) => {
      const baseHex = style.uniform ? (style.uniformColor || '#9e9e9e') : (style.colors[g.parcel.category] || '#9e9e9e');
      const fillColor = Cesium.Color.fromCssColorString(baseHex).withAlpha(style.alpha);
      const outlineColor = Cesium.Color.fromCssColorString(baseHex);

      // 상단: 지형 따라가는 perPositionHeight 폴리곤
      g.top.polygon.hierarchy = new Cesium.PolygonHierarchy(
        topPositionsFor(g.ringCoords, g.terrainHeights, h)
      );
      g.top.polygon.material = fillColor;
      g.top.polygon.fill = style.fill;
      g.top.polygon.outline = style.outline;
      g.top.polygon.outlineColor = outlineColor;
      g.top.polygon.outlineWidth = style.outlineWidth;

      // 벽: 높이 > 0 일 때만 존재
      if (h > 0) {
        const wallPositions = Cesium.Cartesian3.fromDegreesArray(
          g.ringCoords.flatMap(([lng, lat]) => [lng, lat])
        );
        const maxHeights = g.terrainHeights.map(t => t + h);
        if (!g.wall) {
          g.wall = viewer.entities.add({
            wall: {
              positions: wallPositions,
              minimumHeights: g.terrainHeights.slice(),
              maximumHeights: maxHeights,
              material: fillColor,
              fill: style.fill,
              outline: style.outline,
              outlineColor: outlineColor,
              outlineWidth: style.outlineWidth,
            },
          });
        } else {
          g.wall.wall.maximumHeights = maxHeights;
          g.wall.wall.material = fillColor;
          g.wall.wall.fill = style.fill;
          g.wall.wall.outline = style.outline;
          g.wall.wall.outlineColor = outlineColor;
          g.wall.wall.outlineWidth = style.outlineWidth;
        }
      } else if (g.wall) {
        viewer.entities.remove(g.wall);
        g.wall = null;
      }
    });
    viewer.scene.requestRender();
  }

  function getStyle() { return JSON.parse(JSON.stringify(style)); }

  async function toggleGoogle3D(on) {
    if (!viewer) return;
    if (on && !googleTileset) {
      try {
        googleTileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
        viewer.scene.primitives.add(googleTileset);
      } catch (e) {
        console.error('[Cesium] Google 3D Tiles 로드 실패:', e);
        alert('Google 3D Tiles 로드 실패 — Cesium Ion 토큰 확인 필요');
        return;
      }
    }
    if (googleTileset) googleTileset.show = on;
  }

  async function toggleOsmBuildings(on) {
    if (!viewer) return;
    if (on && !osmBuildings) {
      try {
        osmBuildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(osmBuildings);
      } catch (e) {
        console.error('[Cesium] OSM Buildings 로드 실패:', e);
        alert('OSM Buildings 로드 실패');
        return;
      }
    }
    if (osmBuildings) osmBuildings.show = on;
  }

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

  function wireControls() {
    // 2D 모드에서 이미 localStorage 를 업데이트했을 수 있으므로 재동기화
    try {
      const raw = localStorage.getItem('joojoo_style');
      const s = raw ? JSON.parse(raw) : null;
      if (s) {
        Object.assign(style, s);
        if (s.colors) Object.assign(style.colors, s.colors);
      }
    } catch {}

    const g = document.getElementById('toggle-google-3d');
    const o = document.getElementById('toggle-osm-buildings');
    const input = document.getElementById('fly-address');
    const btn = document.getElementById('fly-btn');
    if (g && !g.dataset.wired) {
      g.addEventListener('change', (e) => toggleGoogle3D(e.target.checked));
      g.dataset.wired = '1';
    }
    if (o && !o.dataset.wired) {
      o.addEventListener('change', (e) => toggleOsmBuildings(e.target.checked));
      o.dataset.wired = '1';
    }
    if (btn && !btn.dataset.wired) {
      const go = () => flyToAddress(input.value.trim());
      btn.addEventListener('click', go);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      btn.dataset.wired = '1';
    }

    // 필지 스타일 컨트롤
    const wireRange = (id, valueId, key, fmt) => {
      const el = document.getElementById(id);
      const lbl = document.getElementById(valueId);
      if (!el || el.dataset.wired) return;
      el.value = style[key];
      if (lbl) lbl.textContent = fmt ? fmt(style[key]) : style[key];
      el.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (lbl) lbl.textContent = fmt ? fmt(v) : v;
        applyStyle({ [key]: v });
      });
      el.dataset.wired = '1';
    };
    wireRange('style-height', 'style-height-val', 'height', (v) => `${v}m`);
    wireRange('style-alpha', 'style-alpha-val', 'alpha', (v) => `${Math.round(v*100)}%`);
    wireRange('style-outline-width', 'style-outline-width-val', 'outlineWidth', (v) => `${v}px`);

    const wireCheck = (id, key) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.checked = !!style[key];
      el.addEventListener('change', (e) => applyStyle({ [key]: e.target.checked }));
      el.dataset.wired = '1';
    };
    wireCheck('style-fill', 'fill');
    wireCheck('style-outline', 'outline');

    // 카테고리별 색깔 color picker
    ['전','답','임','임야','대'].forEach((cat) => {
      const id = `style-color-${cat}`;
      const el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.value = style.colors[cat] || '#9e9e9e';
      el.addEventListener('input', (e) => {
        applyStyle({ colors: { [cat]: e.target.value } });
      });
      el.dataset.wired = '1';
    });

    // 단일색 토글 + 색상 — 2D Leaflet 쪽에서도 리스너를 달기 때문에 양쪽 동시 반영
    const uEl = document.getElementById('style-uniform');
    if (uEl && !uEl.dataset.wiredCesium) {
      uEl.checked = !!style.uniform;
      uEl.addEventListener('change', (e) => applyStyle({ uniform: e.target.checked }));
      uEl.dataset.wiredCesium = '1';
    }
    const ucEl = document.getElementById('style-uniform-color');
    if (ucEl && !ucEl.dataset.wiredCesium) {
      ucEl.value = style.uniformColor || defaultStyle.uniformColor;
      ucEl.addEventListener('input', (e) => applyStyle({ uniformColor: e.target.value }));
      ucEl.dataset.wiredCesium = '1';
    }
  }

  function hide() {
    document.getElementById('map').style.display = '';
    document.getElementById('cesium-container').classList.remove('active');
    document.body.classList.remove('mode-3d');
    // Leaflet 지도는 크기가 바뀌었을 수 있으니 invalidate
    if (window.LeafletMap) window.LeafletMap.invalidateSize();
  }

  return {
    register, show, hide,
    toggleGoogle3D, toggleOsmBuildings, toggleLabels, flyToAddress,
    applyStyle, getStyle,
    setAdjacentLayer, clearAdjacentLayer, restyleAdjacentLayer,
  };
})();
