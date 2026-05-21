// JooJoo Land - 34필지 경계 지도
// VWorld 오픈API: 주소 → 좌표 → 지적 폴리곤 조회

const STORAGE_KEY = 'vworld_api_key';

// ==================== 상태 ====================
let map;
let baseLayers = {};
let currentBaseLayer = null;
let cadastralLayer = null;
let polygonsById = {};   // no -> { polygon, label, parcel }
window.polygonsById = polygonsById;
let resolvedParcels = []; // 성공한 필지만
let currentApiKey = '';   // WMS 오버레이 토글용 (startMap 시 세팅)
const wmsLayers = {};     // { layerKey: L.tileLayer.wms }

// ==================== 초기화 ====================
function init() {
  setupKeyModal();
  buildParcelList();
  setupFilters();
  setupCollapsibles();

  // 우선순위: 1) .env → config.js 로 주입된 window.VWORLD_KEY,
  //          2) localStorage,  3) 모달 입력
  let envKey = (window.VWORLD_KEY || '').trim();
  if (envKey === 'PASTE_YOUR_KEY_HERE') envKey = '';
  const storageKey = localStorage.getItem(STORAGE_KEY);
  const key = envKey || storageKey;

  if (!key) {
    showKeyModal();
    return;
  }
  if (envKey) {
    console.info('[app] .env → config.js 에서 VWorld 키 로드');
  }
  startMap(key);
}

function showKeyModal() {
  document.getElementById('key-modal').classList.remove('hidden');
  const hint = document.getElementById('domain-hint');
  hint.textContent = `${window.location.protocol}//${window.location.host || 'localhost:8000'}`;
}

function setupKeyModal() {
  document.getElementById('key-save').addEventListener('click', () => {
    const val = document.getElementById('key-input').value.trim();
    if (!val) {
      alert('API 키를 입력해주세요');
      return;
    }
    localStorage.setItem(STORAGE_KEY, val);
    document.getElementById('key-modal').classList.add('hidden');
    startMap(val);
  });
  document.getElementById('reset-key').addEventListener('click', () => {
    if (confirm('API 키를 재설정하시겠습니까?')) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

// ==================== 지도 초기화 ====================
function startMap(key) {
  currentApiKey = key;
  // 양동면 금왕리 대략 중심 (산205 근처)
  map = L.map('map', {
    center: [37.378, 127.738],
    zoom: 15,
    zoomControl: true,
  });
  window.LeafletMap = map;

  // 2D/3D 토글
  const btn2d = document.getElementById('mode-2d');
  const btn3d = document.getElementById('mode-3d');
  btn2d.addEventListener('click', () => {
    if (!window.CesiumApp) return;
    window.CesiumApp.hide();
    btn2d.classList.add('active');
    btn3d.classList.remove('active');
  });
  btn3d.addEventListener('click', async () => {
    if (!window.CesiumApp) return;
    btn3d.disabled = true;
    btn3d.textContent = '3D 로딩...';
    try {
      await window.CesiumApp.show();
      btn3d.classList.add('active');
      btn2d.classList.remove('active');
    } catch (e) {
      console.error('3D 전환 실패:', e);
      alert('3D 로드 실패: ' + e.message);
    } finally {
      btn3d.disabled = false;
      btn3d.textContent = '3D';
    }
  });

  // 베이스 레이어
  const satellite = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/{z}/{y}/{x}.jpeg`,
    { maxZoom: 19, attribution: '© VWorld' }
  );
  const satelliteHybrid = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png`,
    { maxZoom: 19 }
  );
  const base = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`,
    { maxZoom: 19, attribution: '© VWorld' }
  );
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  });

  // Esri World Imagery — 고해상도 위성 (API 키 불필요, 무료)
  const esriImagery = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri World Imagery' }
  );
  // Esri 하이브리드용 라벨 (VWorld Hybrid 재인스턴스 — 그룹 간 공유 금지)
  const satelliteHybridForEsri = L.tileLayer(
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png`,
    { maxZoom: 19 }
  );
  // Esri World Topo — 지형 + 행정경계
  const esriTopo = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: '© Esri World Topo' }
  );

  baseLayers.satellite = L.layerGroup([satellite, satelliteHybrid]);
  baseLayers.base = base;
  baseLayers.osm = osm;
  baseLayers.esri = L.layerGroup([esriImagery, satelliteHybridForEsri]);
  baseLayers.terrain = esriTopo;

  baseLayers.satellite.addTo(map);
  currentBaseLayer = baseLayers.satellite;

  // 지적편집도 overlay (공공 WMS)
  cadastralLayer = L.tileLayer.wms(
    `https://api.vworld.kr/req/wms?key=${key}`,
    {
      layers: 'lp_pa_cbnd_bubun',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      maxZoom: 19,
    }
  );
  cadastralLayer.addTo(map);

  // 베이스맵 전환 (헤더 버튼)
  const switchBasemap = (name) => {
    const next = baseLayers[name];
    if (!next || next === currentBaseLayer) return;
    if (currentBaseLayer) map.removeLayer(currentBaseLayer);
    currentBaseLayer = next;
    currentBaseLayer.addTo(map);
    if (cadastralLayer && map.hasLayer(cadastralLayer)) cadastralLayer.bringToFront();
    Object.values(polygonsById).forEach(({polygon}) => polygon.bringToFront());
    // WMS 오버레이도 최상단 유지
    Object.values(wmsLayers).forEach(tl => { if (map.hasLayer(tl)) tl.bringToFront(); });
    document.querySelectorAll('.basemap-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.basemap === name);
    });
  };
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', () => switchBasemap(btn.dataset.basemap));
  });

  document.getElementById('toggle-cadastral').addEventListener('change', (e) => {
    if (e.target.checked) cadastralLayer.addTo(map);
    else map.removeLayer(cadastralLayer);
  });

  document.getElementById('toggle-labels').addEventListener('change', (e) => {
    Object.values(polygonsById).forEach(({label}) => {
      if (!label) return;
      if (e.target.checked) label.addTo(map);
      else map.removeLayer(label);
    });
    if (window.CesiumApp && window.CesiumApp.toggleLabels) {
      window.CesiumApp.toggleLabels(e.target.checked);
    }
  });

  // 인접 부지 오버레이 체크박스 리스너는 즉시 부착 (필지 로드와 독립)
  setupAdjacentLayers(key);

  // GIS 오버레이 탭 + WMS 토글 + 2D 필지 스타일 컨트롤 + POI 토글
  setupGisTabs();
  setupWMSLayers();
  setupLeafletParcelStyleControls();
  setupMountainPoiToggle();

  // 필지 로드
  loadAllParcels(key);
}

// ==================== GIS 오버레이 탭 ====================
// VWorld WMS 레이어 ID 매핑. 출처: VWorld 오픈API 문서 + KLIS 데이터셋 카탈로그.
// (β) 로 표기된 것은 레이어 ID 가 서버에서 응답 없을 수 있어 사용자 검증 필요.
const WMS_LAYER_CONFIG = {
  // 🏞 토지용도
  uq161:    { layer: 'lt_c_uq161',    label: '용도지역' },
  uq162:    { layer: 'lt_c_uq162',    label: '용도지구' },
  uq163:    { layer: 'lt_c_uq163',    label: '도시계획시설' },
  landuse:  { layer: 'lt_c_landuse',  label: '토지이용현황' },
  // ⛰ 경사·환경
  slope:    { layer: 'lt_c_damden',   label: '경사도' },
  eco:      { layer: 'lt_c_ecoltm',   label: '생태자연도' },
  kemp:     { layer: 'lt_c_kemp',     label: '국토환경성평가' },
  // 🚧 규제
  ud801:    { layer: 'lt_c_ud801',    label: '개발제한구역' },
  waprl:    { layer: 'lt_c_waprl',    label: '상수원보호구역' },
  wkmstrm:  { layer: 'lt_c_wkmstrm',  label: '수변구역' },
  asetl:    { layer: 'lt_c_asetl',    label: '군사시설보호구역' },
  ascult:   { layer: 'lt_c_ascult',   label: '문화재보호구역' },
  // 🛣 교통
  'road-net': { layer: 'lt_l_moctlink', label: '도로망' },
  'rail-net': { layer: 'lt_l_rwrlline', label: '철도망' },
  // 🌲 산림 — VWorld 카탈로그에 존재하는 산림청 관련 레이어 후보
  //  (타일 미응답이면 tileerror 핸들러가 콘솔 경고. 외부 링크로 대체 조회 가능)
  'forest-stand': { layer: 'lt_c_forest',    label: '임상도' },
  'forest-soil':  { layer: 'lt_c_umsatang',  label: '산림입지토양도' },
  'forest-class': { layer: 'lt_c_umhilmos',  label: '산지구분도' },
  'landslide':    { layer: 'lt_c_axisalko',  label: '산사태위험지도' },
  'eco-nature':   { layer: 'lt_c_uu401',     label: '자연환경보전지역' },
};

// ==================== 2D (Leaflet) 필지 스타일 ====================
// cesium-app.js 와 `joojoo_style` localStorage 키를 공유한다. 양 모듈이
// 같은 DOM 입력에 각자 리스너를 달고 각자 레이어에 반영.
const PARCEL_STYLE_KEY = 'joojoo_style';
const LEAFLET_STYLE_DEFAULTS = {
  alpha: 0.35,          // fillOpacity
  outlineWidth: 2.5,    // weight
  fill: true,
  outline: true,
  colors: { ...(window.CATEGORY_COLORS || {}) },
  uniform: false,
  uniformColor: '#9c27b0',
};
function loadLeafletParcelStyle() {
  try {
    const raw = localStorage.getItem(PARCEL_STYLE_KEY);
    const s = raw ? JSON.parse(raw) : {};
    const merged = { ...LEAFLET_STYLE_DEFAULTS, ...s };
    merged.colors = { ...LEAFLET_STYLE_DEFAULTS.colors, ...(s.colors || {}) };
    if (typeof merged.uniform !== 'boolean') merged.uniform = false;
    if (!merged.uniformColor) merged.uniformColor = LEAFLET_STYLE_DEFAULTS.uniformColor;
    return merged;
  } catch { return { ...LEAFLET_STYLE_DEFAULTS }; }
}
const leafletParcelStyle = loadLeafletParcelStyle();

function saveLeafletParcelStyle() {
  let existing = {};
  try { existing = JSON.parse(localStorage.getItem(PARCEL_STYLE_KEY) || '{}'); } catch {}
  const merged = { ...existing, ...leafletParcelStyle };
  merged.colors = { ...(existing.colors || {}), ...leafletParcelStyle.colors };
  try { localStorage.setItem(PARCEL_STYLE_KEY, JSON.stringify(merged)); } catch {}
}

function parcelColorFor(parcel) {
  if (leafletParcelStyle.uniform) return leafletParcelStyle.uniformColor || '#9c27b0';
  return leafletParcelStyle.colors[parcel.category] || '#9e9e9e';
}

function applyLeafletParcelStyle() {
  Object.values(polygonsById).forEach(({polygon, parcel}) => {
    if (!polygon || !parcel) return;
    const base = parcelColorFor(parcel);
    polygon.setStyle({
      color: base,
      fillColor: base,
      fillOpacity: leafletParcelStyle.fill ? leafletParcelStyle.alpha : 0,
      opacity: leafletParcelStyle.outline ? 0.95 : 0,
      weight: leafletParcelStyle.outline ? leafletParcelStyle.outlineWidth : 0,
    });
  });
}

function setupLeafletParcelStyleControls() {
  const alphaEl = document.getElementById('style-alpha');
  const alphaLbl = document.getElementById('style-alpha-val');
  if (alphaEl) {
    alphaEl.value = leafletParcelStyle.alpha;
    if (alphaLbl) alphaLbl.textContent = `${Math.round(leafletParcelStyle.alpha*100)}%`;
    alphaEl.addEventListener('input', (e) => {
      leafletParcelStyle.alpha = parseFloat(e.target.value);
      if (alphaLbl) alphaLbl.textContent = `${Math.round(leafletParcelStyle.alpha*100)}%`;
      applyLeafletParcelStyle(); saveLeafletParcelStyle();
    });
  }
  const owEl = document.getElementById('style-outline-width');
  const owLbl = document.getElementById('style-outline-width-val');
  if (owEl) {
    owEl.value = leafletParcelStyle.outlineWidth;
    if (owLbl) owLbl.textContent = `${leafletParcelStyle.outlineWidth}px`;
    owEl.addEventListener('input', (e) => {
      leafletParcelStyle.outlineWidth = parseFloat(e.target.value);
      if (owLbl) owLbl.textContent = `${leafletParcelStyle.outlineWidth}px`;
      applyLeafletParcelStyle(); saveLeafletParcelStyle();
    });
  }
  const fillEl = document.getElementById('style-fill');
  if (fillEl) {
    fillEl.checked = leafletParcelStyle.fill;
    fillEl.addEventListener('change', (e) => {
      leafletParcelStyle.fill = e.target.checked;
      applyLeafletParcelStyle(); saveLeafletParcelStyle();
    });
  }
  const outEl = document.getElementById('style-outline');
  if (outEl) {
    outEl.checked = leafletParcelStyle.outline;
    outEl.addEventListener('change', (e) => {
      leafletParcelStyle.outline = e.target.checked;
      applyLeafletParcelStyle(); saveLeafletParcelStyle();
    });
  }
  ['전','답','임','임야','대'].forEach(cat => {
    const el = document.getElementById(`style-color-${cat}`);
    if (!el) return;
    el.value = leafletParcelStyle.colors[cat] || '#9e9e9e';
    el.addEventListener('input', (e) => {
      leafletParcelStyle.colors[cat] = e.target.value;
      if (!leafletParcelStyle.uniform) applyLeafletParcelStyle();
      saveLeafletParcelStyle();
    });
  });
  const uEl = document.getElementById('style-uniform');
  const ucEl = document.getElementById('style-uniform-color');
  if (uEl) {
    uEl.checked = !!leafletParcelStyle.uniform;
    uEl.addEventListener('change', (e) => {
      leafletParcelStyle.uniform = e.target.checked;
      applyLeafletParcelStyle(); saveLeafletParcelStyle();
      if (window.CesiumApp?.applyStyle) {
        window.CesiumApp.applyStyle({ uniform: leafletParcelStyle.uniform, uniformColor: leafletParcelStyle.uniformColor });
      }
    });
  }
  if (ucEl) {
    ucEl.value = leafletParcelStyle.uniformColor;
    ucEl.addEventListener('input', (e) => {
      leafletParcelStyle.uniformColor = e.target.value;
      if (leafletParcelStyle.uniform) applyLeafletParcelStyle();
      saveLeafletParcelStyle();
      if (window.CesiumApp?.applyStyle) {
        window.CesiumApp.applyStyle({ uniformColor: leafletParcelStyle.uniformColor });
      }
    });
  }
}

// ==================== Mountain POI 지도 오버레이 ====================
let _mountainPoiLayerGroup = null;
let _mountainPoiCache = null;

const POI_CATEGORY_COLOR = {
  '이정표':'#ffd54f','안내판':'#81c784','갈림길':'#ffb74d',
  '정상':'#e57373','봉우리':'#ba68c8','화장실':'#4fc3f7',
  '쉼터':'#aed581','주차장':'#90caf9','야영지':'#a5d6a7',
  '전망대':'#ff8a65','대피소':'#f06292','수원':'#4dd0e1',
  '약수':'#64b5f6','능선지점':'#dce775','기타':'#b0bec5',
};

async function loadMountainPoi() {
  if (_mountainPoiCache) return _mountainPoiCache;
  const items = [];
  Object.values(polygonsById).forEach(entry => {
    const f = entry?.polygon?.feature;
    if (f && f.geometry) items.push(f.geometry);
  });
  if (items.length === 0) return null;
  try {
    const r = await fetch('/api/forest/nearby-poi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcels: items, radius_m: 5000, limit: 2000 }),
    });
    if (!r.ok) return null;
    _mountainPoiCache = await r.json();
    return _mountainPoiCache;
  } catch { return null; }
}

function renderMountainPoi(data) {
  if (!data || !data.points) return;
  _mountainPoiLayerGroup = L.layerGroup();
  data.points.forEach(p => {
    const color = POI_CATEGORY_COLOR[p.category] || '#b0bec5';
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 5,
      color: '#222',
      weight: 1,
      fillColor: color,
      fillOpacity: 0.85,
    });
    marker.bindPopup(
      `<div class="popup-title">🥾 ${p.name || '등산 지점'}</div>` +
      `<div class="popup-row"><strong>분류</strong><span>${p.category}</span></div>` +
      `<div class="popup-row"><strong>상세</strong><span>${p.detail || '-'}</span></div>` +
      `<div class="popup-row"><strong>거리</strong><span>${Math.round(p.distance_m)}m</span></div>`
    );
    marker.addTo(_mountainPoiLayerGroup);
  });
  _mountainPoiLayerGroup.addTo(map);
}

function setupMountainPoiToggle() {
  const cb = document.getElementById('toggle-mountain-poi');
  if (!cb) return;
  cb.addEventListener('change', async () => {
    if (cb.checked) {
      cb.disabled = true;
      try {
        const data = await loadMountainPoi();
        if (!data || !data.total) {
          alert('주변 POI 데이터가 없습니다. (산림청 등산로 포인트 적재 필요)');
          cb.checked = false;
          return;
        }
        renderMountainPoi(data);
      } finally {
        cb.disabled = false;
      }
    } else if (_mountainPoiLayerGroup) {
      map.removeLayer(_mountainPoiLayerGroup);
      _mountainPoiLayerGroup = null;
    }
  });
}

function setupGisTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const panels  = document.querySelectorAll('.tab-panel');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
    });
  });
}

function setupWMSLayers() {
  document.querySelectorAll('.wms-toggle').forEach(cb => {
    cb.addEventListener('change', () => toggleWMSLayer(cb.value, cb.checked, cb));
  });
}

function toggleWMSLayer(key, enabled, cb) {
  const cfg = WMS_LAYER_CONFIG[key];
  if (!cfg || !map || !currentApiKey) return;
  if (enabled) {
    if (!wmsLayers[key]) {
      const tl = L.tileLayer.wms(
        `https://api.vworld.kr/req/wms?key=${currentApiKey}`,
        {
          layers: cfg.layer,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          maxZoom: 19,
          opacity: 0.75,
        }
      );
      tl.on('tileerror', () => {
        if (!tl._erroredOnce) {
          tl._erroredOnce = true;
          console.warn(`[WMS] ${cfg.label} (${cfg.layer}) 타일 응답 없음 — VWorld 에서 제공 안할 수 있음`);
        }
      });
      wmsLayers[key] = tl;
    }
    wmsLayers[key].addTo(map);
    wmsLayers[key].bringToFront();
    if (cadastralLayer && map.hasLayer(cadastralLayer)) cadastralLayer.bringToFront();
    Object.values(polygonsById).forEach(({polygon, label}) => {
      polygon.bringToFront();
      if (label) label.setZIndexOffset(1000);
    });
  } else {
    if (wmsLayers[key] && map.hasLayer(wmsLayers[key])) {
      map.removeLayer(wmsLayers[key]);
    }
  }
}

// ==================== 인접 부지 오버레이 ====================
// 연속지적도(LP_PA_CBND_BUBUN)는 지목 속성 미노출.
// → BBOX 로 전체 PNU 가져와 VWorld NED getLandCharacteristics 로 ladUseSittnNm(토지이용상황) 보강.
// 기본 스타일. 채우기 투명도(fillOpacity)는 0..1. UI 에서 0..100 % 로 노출.
const ADJ_LAYER_CONFIG = {
  road:     { label: '도로',           color: '#ff5722', fillOpacity: 0.45, matchAny: ['도로', '국도', '지방도', '고속도'] },
  ditch:    { label: '구거',           color: '#00e5ff', fillOpacity: 0.40, matchAny: ['구거'] },
  river:    { label: '하천·제방·유지', color: '#2196f3', fillOpacity: 0.40, matchAny: ['하천', '제방', '유지'] },
  public:   { label: '국공유지',       color: '#ffc107', fillOpacity: 0.40, matchAny: null, note: 'ownership' },
  military: { label: '군유지',         color: '#ff1744', fillOpacity: 0.45, matchAny: null, note: 'ownership' },
};

// 사용자 커스터마이즈 — localStorage 에 영속
const ADJ_STYLE_STORAGE_KEY = 'joojoo_adj_layer_styles_v1';
function loadAdjStyles() {
  try {
    const raw = localStorage.getItem(ADJ_STYLE_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    Object.keys(ADJ_LAYER_CONFIG).forEach(type => {
      const s = saved[type];
      if (!s) return;
      if (typeof s.color === 'string') ADJ_LAYER_CONFIG[type].color = s.color;
      if (typeof s.fillOpacity === 'number') ADJ_LAYER_CONFIG[type].fillOpacity = s.fillOpacity;
    });
  } catch (e) { console.warn('[adj-style] load 실패:', e.message); }
}
function saveAdjStyles() {
  const out = {};
  Object.entries(ADJ_LAYER_CONFIG).forEach(([type, cfg]) => {
    out[type] = { color: cfg.color, fillOpacity: cfg.fillOpacity };
  });
  try { localStorage.setItem(ADJ_STYLE_STORAGE_KEY, JSON.stringify(out)); }
  catch (e) { console.warn('[adj-style] save 실패:', e.message); }
}
loadAdjStyles();

// 지목 코드 (KLIS 표준, 28종). VWorld WFS 가 코드 필드를 돌려주면 이걸로 매칭
const JIMOK_CODE_ROAD = new Set(['14', '도']);

// 인접도 판정 기준 (미터). 공유 경계 꼭짓점은 보통 0~1m, 여유로 15m
const ADJACENCY_MAX_METERS = 15;

const adjacentLayerGroups = {}; // type -> L.LayerGroup
window.adjacentLayerGroups = adjacentLayerGroups;
let _adjBBoxCached = null;
let _targetVertexSetsCache = null;

function getTargetBBoxString() {
  if (_adjBBoxCached) return _adjBBoxCached;
  const polys = Object.values(polygonsById);
  if (polys.length === 0) return null;
  let bounds = polys[0].polygon.getBounds();
  polys.slice(1).forEach(({polygon}) => { bounds = bounds.extend(polygon.getBounds()); });
  const pad = 0.003; // 약 300m
  const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
  _adjBBoxCached = `BOX(${sw.lng - pad},${sw.lat - pad},${ne.lng + pad},${ne.lat + pad})`;
  return _adjBBoxCached;
}

// BBOX 전체 필지 (캐시) — 한 번만 긁어 모든 오버레이가 공유
let _bboxParcelsCache = null;
async function loadBBoxParcels(bbox, key) {
  if (_bboxParcelsCache) return _bboxParcelsCache;
  const bboxCacheKey = `bbox:${bbox}`;
  const stored = cacheGet(bboxCacheKey);
  if (stored) {
    console.info(`[adjacent] BBOX 캐시 적중 (${stored.length}건)`);
    _bboxParcelsCache = stored;
    return stored;
  }
  console.info(`[adjacent] BBOX WFS 쿼리`, bbox);
  const feats = await wfsQuery({ geomFilter: bbox, size: '1000', crs: 'EPSG:4326' }, key);
  console.info(`[adjacent] BBOX 응답 ${feats.length}건`);
  cacheSet(bboxCacheKey, feats);
  _bboxParcelsCache = feats;
  return feats;
}

// PNU 별 토지이용상황 (NED getLandCharacteristics) — 개별 캐시
async function fetchLandCharacteristics(pnu, key) {
  if (!pnu) return null;
  const cached = cacheGet('char:' + pnu);
  if (cached !== null) return cached;
  const url = `/api/vworld/ned/getLandCharacteristics?` + new URLSearchParams({
    key, pnu, format: 'json', domain: window.location.hostname || 'localhost',
  });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const root = data?.landCharacteristicss || data?.response;
    const resultCode = root?.resultCode || data?.response?.status;
    if (resultCode && resultCode !== 'OK' && resultCode !== 'NORMAL_SERVICE') {
      throw new Error(`${resultCode}: ${root?.resultMsg || ''}`);
    }
    const fields = root?.field || root?.fields?.field || [];
    const arr = Array.isArray(fields) ? fields : [fields];
    if (arr.length === 0) { cacheSet('char:' + pnu, { ladUseSittnNm: null }); return { ladUseSittnNm: null }; }
    arr.sort((a, b) => String(b.lastUpdtDt || '').localeCompare(String(a.lastUpdtDt || '')));
    const pick = arr[0];
    const result = {
      ladUseSittnNm: pick.ladUseSittnNm || pick.prposArea1Nm || null,
      raw: pick,
    };
    cacheSet('char:' + pnu, result);
    return result;
  } catch (e) {
    console.warn(`[adjacent] getLandCharacteristics 실패 pnu=${pnu}:`, e.message);
    return null;
  }
}

// GeoJSON Feature 의 모든 외곽 꼭짓점을 L.LatLng 배열로
function featureVertices(feature) {
  const out = [];
  const g = feature && feature.geometry;
  if (!g) return out;
  const rings = g.type === 'Polygon' ? g.coordinates
              : g.type === 'MultiPolygon' ? g.coordinates.flat(1)
              : [];
  for (const ring of rings) {
    for (const c of ring) {
      out.push(L.latLng(c[1], c[0]));
    }
  }
  return out;
}

function getTargetVertexSets() {
  if (_targetVertexSetsCache) return _targetVertexSetsCache;
  const sets = [];
  Object.values(polygonsById).forEach(({polygon}) => {
    const f = polygon && polygon.feature;
    if (!f) return;
    const verts = featureVertices(f);
    if (verts.length === 0) return;
    sets.push({ verts, bounds: L.latLngBounds(verts) });
  });
  _targetVertexSetsCache = sets;
  return sets;
}

// 후보 필지가 대상 필지들과 인접(공유 경계 또는 ≤maxMeters) 인지.
// bbox 사전 필터로 대부분 후보를 빠르게 걸러 낸 뒤에만 꼭짓점 거리 계산.
function isAdjacentToTargets(candidateFeature, maxMeters = ADJACENCY_MAX_METERS) {
  const candVerts = featureVertices(candidateFeature);
  if (candVerts.length === 0) return false;
  const candBounds = L.latLngBounds(candVerts);
  const bufDeg = maxMeters / 111000; // 위경도 근사 — 빠른 사전 체크용
  const targetSets = getTargetVertexSets();
  for (const { verts, bounds } of targetSets) {
    const expanded = L.latLngBounds(
      [bounds.getSouth() - bufDeg, bounds.getWest() - bufDeg],
      [bounds.getNorth() + bufDeg, bounds.getEast() + bufDeg]
    );
    if (!expanded.intersects(candBounds)) continue;
    for (let i = 0; i < candVerts.length; i++) {
      for (let j = 0; j < verts.length; j++) {
        if (candVerts[i].distanceTo(verts[j]) <= maxMeters) return true;
      }
    }
  }
  return false;
}

// WFS 속성만으로 '도로' 여부 판정 시도 (API 추가 호출 없이).
// VWorld 버전·레이어에 따라 jibun 에 지목 suffix 가 붙는 경우와 숫자만 오는 경우가 있어
// 후보 필드를 여러 개 체크한다.
function detectRoadFromProps(props) {
  if (!props) return false;
  const jibun = String(props.jibun || '');
  // "3도" "484-1도" 같이 한글 suffix 로 끝나면 '도' 만 허용 (도로/도시는 지목 아님)
  const suffixMatch = jibun.match(/([가-힣]+)$/);
  if (suffixMatch) {
    const suf = suffixMatch[1];
    if (suf === '도' || suf === '도로') return true;
  }
  // 지목 코드 필드 (VWorld 레이어마다 이름 상이)
  const codeLike = String(
    props.jimok || props.JIMOK ||
    props.gosamjijok || props.GOSAMJIJOK ||
    props.jimokCd || props.jimok_cd ||
    props.jimok_nm || props.jimokNm || ''
  );
  if (!codeLike) return false;
  if (JIMOK_CODE_ROAD.has(codeLike)) return true;
  if (codeLike === '도로') return true;
  return false;
}

async function loadRoadAdjacentByCadastral(key, cfg) {
  const bbox = getTargetBBoxString();
  if (!bbox) { alert('필지 로드 완료 후 다시 시도해주세요'); return; }
  updateProgress(0, 1, `${cfg.label}: BBOX 필지 수집 중...`);
  const parcels = await loadBBoxParcels(bbox, key);

  const targetPnus = new Set();
  Object.values(polygonsById).forEach(({polygon}) => {
    const f = polygon && polygon.feature;
    if (f && f.properties && f.properties.pnu) targetPnus.add(f.properties.pnu);
  });

  updateProgress(0, 1, `${cfg.label}: 인접도 계산 중... (${parcels.length}필지)`);

  // 1) 대상 제외 + 인접성 필터 (빠름, 로컬 계산)
  const adjacentCandidates = parcels.filter(f => {
    if (!f.properties || !f.properties.pnu) return false;
    if (targetPnus.has(f.properties.pnu)) return false;
    return isAdjacentToTargets(f);
  });
  console.info(`[road-adj] BBOX ${parcels.length} → 인접 ${adjacentCandidates.length}건`);

  // 2) 속성 기반 '도' 매칭 먼저 시도 (API 호출 0회)
  const propMatched = adjacentCandidates.filter(f => detectRoadFromProps(f.properties));
  console.info(`[road-adj] 속성 기반 매칭 ${propMatched.length}건`);

  let matched = propMatched;

  // 3) 속성만으로 매칭 실패 → 인접 후보에 한해서만 NED API 조회
  //    (기존 로직은 BBOX 전체를 조회해 레이트리밋 에러 발생 → 지금은 수십건 이하)
  if (matched.length === 0 && adjacentCandidates.length > 0) {
    console.info('[road-adj] 속성 매칭 0건 → 인접 후보만 NED 조회로 폴백');
    const concurrency = 4;
    const q = [...adjacentCandidates];
    let done = 0;
    const fallbackMatched = [];
    async function worker() {
      while (q.length) {
        const f = q.shift();
        if (!f) break;
        const pnu = f.properties.pnu;
        const info = await fetchLandCharacteristics(pnu, key);
        const name = info?.ladUseSittnNm || '';
        if (name && cfg.matchAny.some(kw => name.includes(kw))) {
          f.properties._ladUseSittnNm = name;
          fallbackMatched.push(f);
        }
        done++;
        if (done % 5 === 0 || done === adjacentCandidates.length) {
          updateProgress(done, adjacentCandidates.length,
            `${cfg.label}: NED 폴백 ${done}/${adjacentCandidates.length} (매칭 ${fallbackMatched.length})`);
        }
      }
    }
    await Promise.all(Array.from({length: concurrency}, worker));
    matched = fallbackMatched;
  }

  if (matched.length === 0) {
    // 진단: 첫 3건의 속성 키를 콘솔에 남겨 필드명 확인 용이
    if (parcels.length > 0) {
      console.info('[road-adj] 진단용 BBOX 샘플 속성:', parcels.slice(0, 3).map(f => f.properties));
    }
    updateProgress(1, 1, `${cfg.label}: 인접 도로 없음`);
    alert(`${cfg.label}: 인접 ${adjacentCandidates.length}필지 중 "도" 지번 매칭 0건.\n` +
          `속성 필드 확인이 필요하면 DevTools 콘솔에 샘플이 출력되어 있습니다.`);
    return;
  }

  renderAdjacentLayer('road', matched, cfg);
  updateProgress(1, 1, `${cfg.label}: 인접 ${matched.length}건 표시`);
}

async function loadAdjacentLayer(type, key) {
  const cfg = ADJ_LAYER_CONFIG[type];
  if (!cfg) return;
  const bbox = getTargetBBoxString();
  if (!bbox) { alert('필지 로드 완료 후 다시 시도해주세요'); return; }

  // 임시 (2026-04-23): 도로는 BBOX 전체 NED 조회가 레이트리밋 에러를 유발 →
  // 지적도 jibun suffix 파싱 + 인접도(꼭짓점 거리 ≤15m) 기반으로 빠르게 식별.
  // 원래 경로는 NED getLandCharacteristics 복구 후 되돌릴 것.
  if (type === 'road') {
    try { await loadRoadAdjacentByCadastral(key, cfg); }
    catch (e) {
      console.error('[adjacent] 도로 로드 실패:', e);
      alert(`${cfg.label} 로드 실패: ${e.message}`);
    }
    return;
  }

  if (!cfg.matchAny) {
    alert(
      `${cfg.label} 레이어는 VWorld 공개 API 에서 소유구분 속성 미제공으로\n` +
      `현재 표시가 불가합니다.\n\n추후 KAIS/등기 연계 후 복구 예정.`
    );
    const cb = document.querySelector(`.layer-toggle[value="${type}"]`);
    if (cb) cb.checked = false;
    return;
  }

  try {
    updateProgress(0, 1, `${cfg.label}: BBOX 필지 수집 중...`);
    const parcels = await loadBBoxParcels(bbox, key);

    const targetPnus = new Set();
    Object.values(polygonsById).forEach(({polygon}) => {
      const f = polygon.feature;
      if (f && f.properties && f.properties.pnu) targetPnus.add(f.properties.pnu);
    });
    const candidates = parcels.filter(f => !targetPnus.has(f.properties?.pnu) && f.properties?.pnu);

    const matched = [];
    let done = 0;
    const concurrency = 4;
    const q = [...candidates];
    async function worker() {
      while (q.length) {
        const f = q.shift();
        if (!f) break;
        const pnu = f.properties.pnu;
        const info = await fetchLandCharacteristics(pnu, key);
        const name = info?.ladUseSittnNm || '';
        if (name && cfg.matchAny.some(kw => name.includes(kw))) {
          f.properties._ladUseSittnNm = name;
          matched.push(f);
        }
        done++;
        if (done % 10 === 0) updateProgress(done, candidates.length, `${cfg.label}: ${done}/${candidates.length} 조회 (매칭 ${matched.length})`);
      }
    }
    await Promise.all(Array.from({length: concurrency}, worker));

    if (matched.length === 0) {
      updateProgress(1, 1, `${cfg.label}: 매칭 필지 없음`);
      alert(`${cfg.label}: BBOX ${candidates.length}필지 조회했으나 매칭 0건.\n(키워드: ${cfg.matchAny.join(', ')})`);
      return;
    }
    renderAdjacentLayer(type, matched, cfg);
    updateProgress(1, 1, `${cfg.label}: ${matched.length}건 표시`);
  } catch (e) {
    console.error(`[adjacent] ${cfg.label} 로드 실패:`, e);
    alert(`${cfg.label} 로드 실패: ${e.message}`);
  }
}

function styleForAdjLayer(type) {
  const cfg = ADJ_LAYER_CONFIG[type];
  return {
    color: cfg.color,
    weight: 1.5,
    opacity: 0.9,
    fillColor: cfg.color,
    fillOpacity: typeof cfg.fillOpacity === 'number' ? cfg.fillOpacity : 0.4,
    dashArray: type === 'road' ? '4,3' : null,
  };
}

// 각 type 별 가장 최근 features 보관 — 스타일 재계산·3D 재적용 용
const adjacentFeaturesByType = {};
window.adjacentFeaturesByType = adjacentFeaturesByType;

function renderAdjacentLayer(type, features, cfg) {
  const group = L.layerGroup();
  const style = styleForAdjLayer(type);
  features.forEach(f => {
    const layer = L.geoJSON(f, { style });
    const p = f.properties || {};
    layer.bindPopup(
      `<div class="popup-title">${cfg.label}</div>` +
      `<div class="popup-row"><strong>지번</strong><span>${p.jibun || '-'}</span></div>` +
      `<div class="popup-row"><strong>이용상황</strong><span>${p._ladUseSittnNm || '-'}</span></div>` +
      (p.pnu ? `<div class="popup-row"><strong>PNU</strong><span style="font-family:monospace;font-size:11px">${p.pnu}</span></div>` : '')
    );
    layer.addTo(group);
  });
  group.addTo(map);
  // 대상 필지·라벨 위로 올리지 않고 밑에 깔리게
  Object.values(polygonsById).forEach(({polygon, label}) => {
    polygon.bringToFront();
    if (label) label.setZIndexOffset(1000);
  });
  adjacentLayerGroups[type] = group;
  adjacentFeaturesByType[type] = features;
  updateLegendAdjVisibility();
  // 3D 동기화 — Cesium 이 아직 초기화 전이어도 pending 큐에 들어감
  if (window.CesiumApp?.setAdjacentLayer) {
    window.CesiumApp.setAdjacentLayer(type, features, ADJ_LAYER_CONFIG[type]);
  }
}

// 이미 그려진 그룹의 모든 하위 레이어에 스타일 재적용
function reapplyAdjLayerStyle(type) {
  const group = adjacentLayerGroups[type];
  const style = styleForAdjLayer(type);
  if (group) {
    group.eachLayer(sub => {
      if (typeof sub.setStyle === 'function') sub.setStyle(style);
      else if (sub.eachLayer) sub.eachLayer(inner => inner.setStyle && inner.setStyle(style));
    });
  }
  // 3D 도 동시에 갱신
  if (window.CesiumApp?.restyleAdjacentLayer) {
    window.CesiumApp.restyleAdjacentLayer(type, ADJ_LAYER_CONFIG[type]);
  }
}

// 사이드바 swatch + 범례 swatch 를 현재 색상으로 동기화
function syncAdjSwatches(type) {
  const cfg = ADJ_LAYER_CONFIG[type];
  document.querySelectorAll(`.layer-swatch[data-type="${type}"], .legend-color[data-type="${type}"]`).forEach(el => {
    el.style.background = cfg.color;
  });
}

function updateLegendAdjVisibility() {
  document.querySelectorAll('.legend-adj').forEach(el => {
    const type = el.dataset.type;
    const active = Boolean(adjacentLayerGroups[type]);
    if (active) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
}

// 초기값 반영 + 이벤트 연결
function setupAdjacentStyleControls() {
  Object.keys(ADJ_LAYER_CONFIG).forEach(type => {
    const cfg = ADJ_LAYER_CONFIG[type];
    const colorEl = document.querySelector(`.adj-color[data-type="${type}"]`);
    const alphaEl = document.querySelector(`.adj-alpha[data-type="${type}"]`);
    if (colorEl) {
      colorEl.value = cfg.color;
      colorEl.addEventListener('input', (e) => {
        cfg.color = e.target.value;
        syncAdjSwatches(type);
        reapplyAdjLayerStyle(type);
        saveAdjStyles();
      });
    }
    if (alphaEl) {
      alphaEl.value = String(Math.round((cfg.fillOpacity ?? 0.4) * 100));
      alphaEl.addEventListener('input', (e) => {
        cfg.fillOpacity = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
        reapplyAdjLayerStyle(type);
        saveAdjStyles();
      });
    }
    syncAdjSwatches(type);
  });
  updateLegendAdjVisibility();
}

function removeAdjacentLayer(type) {
  const g = adjacentLayerGroups[type];
  if (g) {
    map.removeLayer(g);
    delete adjacentLayerGroups[type];
  }
  delete adjacentFeaturesByType[type];
  updateLegendAdjVisibility();
  if (window.CesiumApp?.clearAdjacentLayer) {
    window.CesiumApp.clearAdjacentLayer(type);
  }
}

function setupAdjacentLayers(key) {
  setupAdjacentStyleControls();
  document.querySelectorAll('.layer-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      const type = cb.value;
      if (cb.checked) {
        cb.disabled = true;
        try { await loadAdjacentLayer(type, key); }
        finally { cb.disabled = false; }
      } else {
        removeAdjacentLayer(type);
      }
    });
  });
}

// ==================== 필지 목록 (사이드바) ====================
function buildParcelList() {
  const container = document.getElementById('parcel-list');
  container.innerHTML = '';
  window.PARCELS.forEach(p => {
    const item = document.createElement('div');
    item.className = 'parcel-item';
    item.dataset.no = p.no;
    item.innerHTML = `
      <span class="parcel-no">${p.no}</span>
      <span class="parcel-lot">${p.location} ${p.lot}</span>
      <span class="parcel-meta">${p.area_pyeong.toLocaleString()}평</span>
    `;
    item.addEventListener('click', () => {
      const entry = polygonsById[p.no];
      if (entry && entry.polygon) {
        map.fitBounds(entry.polygon.getBounds(), { maxZoom: 18, padding: [40, 40] });
        entry.polygon.openPopup();
        document.querySelectorAll('.parcel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      }
    });
    container.appendChild(item);
  });
}

function markParcelStatus(no, status) {
  const el = document.querySelector(`.parcel-item[data-no="${no}"]`);
  if (!el) return;
  el.classList.toggle('failed', status === 'failed');
}

// ==================== 사이드바 섹션 접기/펴기 ====================
function setupCollapsibles() {
  const COLLAPSE_KEY = 'joojoo_collapsed_sections';
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) {}

  const toggles = [
    ...document.querySelectorAll('.sidebar-section > h3'),
    ...document.querySelectorAll('.filter-group > strong'),
  ];
  toggles.forEach((title) => {
    const parent = title.parentElement;
    const id = (title.textContent || '').replace(/\s+/g, ' ').trim();
    if (collapsed[id]) parent.classList.add('collapsed');
    title.addEventListener('click', () => {
      parent.classList.toggle('collapsed');
      collapsed[id] = parent.classList.contains('collapsed');
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    });
  });
}

// ==================== 필터 ====================
function setupFilters() {
  // 현재 PARCELS 에서 고유 카테고리·소유자 추출
  const cats = [...new Set(window.PARCELS.map(p => p.category).filter(Boolean))];
  const owners = [...new Set(window.PARCELS.map(p => p.owner).filter(Boolean))];

  const catContainer = document.getElementById('filter-categories');
  const ownerContainer = document.getElementById('filter-owners');
  if (catContainer) {
    catContainer.innerHTML = cats.map(c =>
      `<label><input type="checkbox" class="filter-category" value="${c}" checked /> ${c}</label>`
    ).join('');
  }
  if (ownerContainer) {
    ownerContainer.innerHTML = owners.map(o =>
      `<label><input type="checkbox" class="filter-owner" value="${o}" checked /> ${o}</label>`
    ).join('');
  }

  const apply = () => {
    const activeCats = Array.from(document.querySelectorAll('.filter-category:checked')).map(el => el.value);
    const activeOwners = Array.from(document.querySelectorAll('.filter-owner:checked')).map(el => el.value);
    Object.entries(polygonsById).forEach(([no, {polygon, label, parcel}]) => {
      const visible = activeCats.includes(parcel.category) && activeOwners.includes(parcel.owner);
      if (visible) {
        polygon.addTo(map);
        if (label && document.getElementById('toggle-labels').checked) label.addTo(map);
      } else {
        map.removeLayer(polygon);
        if (label) map.removeLayer(label);
      }
    });
  };
  document.querySelectorAll('.filter-category, .filter-owner').forEach(el => {
    el.addEventListener('change', apply);
  });
}

// ==================== localStorage 캐시 (VWorld 쿼터 절약) ====================
const CACHE_PREFIX = 'vw_v1:';
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[cache] localStorage 저장 실패 (쿼터 초과 가능):', e.message);
  }
}
window.clearVWorldCache = function() {
  let n = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) { localStorage.removeItem(k); n++; }
  }
  console.info(`[cache] ${n}건 삭제. 새로고침(F5)하세요.`);
  return n;
};

// ==================== VWorld API 호출 ====================
// 공통 재시도 (transient "INCORRECT_KEY" 등 rate-limit 대응)
async function fetchWithRetry(url, retries = 3, delay = 600) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.response.status === 'OK') return data;
      const err = data.response.error;
      // INCORRECT_KEY 는 transient rate-limit 증상으로 간주 → 재시도
      if (err && (err.code === 'INCORRECT_KEY' || err.code === 'TIMEOUT')) {
        lastErr = new Error(`${err.code}: ${err.text}`);
      } else {
        throw new Error(`${err?.code || data.response.status}: ${err?.text || ''}`);
      }
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) await new Promise(r => setTimeout(r, delay * (i + 1)));
  }
  throw lastErr;
}

async function geocodeParcel(parcel, key) {
  const address = window.buildAddress(parcel);
  const cached = cacheGet('geo:' + address);
  if (cached) { console.debug('[cache] geocode 적중:', address); return cached; }
  const url = `/api/vworld/address?` + new URLSearchParams({
    service: 'address',
    request: 'getcoord',
    version: '2.0',
    crs: 'epsg:4326',
    address: address,
    type: 'PARCEL',
    format: 'json',
    errorformat: 'json',
    key: key,
  });
  const data = await fetchWithRetry(url);
  const pt = data.response.result.point;
  const pnu = data.response.refined?.structure?.level4LC || null;
  const result = { lng: parseFloat(pt.x), lat: parseFloat(pt.y), pnu };
  cacheSet('geo:' + address, result);
  return result;
}

async function wfsQuery(filterParams, key) {
  const url = `/api/vworld/data?` + new URLSearchParams({
    service: 'data',
    request: 'GetFeature',
    data: 'LP_PA_CBND_BUBUN',
    ...filterParams,
    geometry: 'true',
    attribute: 'true',
    format: 'json',
    key: key,
    domain: window.location.hostname || 'localhost',
  });
  const data = await fetchWithRetry(url);
  const fc = data.response.result.featureCollection;
  return (fc && fc.features) ? fc.features : [];
}

// 3단계 fallback: PNU → POINT → BBOX(근처 폴리곤 중 소유 필지 번호 매칭)
async function fetchParcelPolygon(geocoded, parcel, key) {
  const cacheKey = 'poly:' + (geocoded.pnu || window.buildAddress(parcel));
  const cached = cacheGet(cacheKey);
  if (cached) { console.debug('[cache] polygon 적중:', parcel.lot); return cached; }
  const feature = await _fetchParcelPolygonImpl(geocoded, parcel, key);
  cacheSet(cacheKey, feature);
  return feature;
}

async function _fetchParcelPolygonImpl(geocoded, parcel, key) {
  const { lng, lat, pnu } = geocoded;

  // 1차: PNU attrFilter
  if (pnu) {
    try {
      const feats = await wfsQuery({
        attrFilter: `pnu:=:${pnu}`,
        size: '1',
      }, key);
      if (feats.length > 0) return feats[0];
    } catch (e) { /* fall through */ }
  }

  // 2차: POINT geomFilter
  try {
    const feats = await wfsQuery({
      geomFilter: `POINT(${lng} ${lat})`,
      size: '1',
    }, key);
    if (feats.length > 0) return feats[0];
  } catch (e) { /* fall through */ }

  // 3차: BBOX geomFilter (약 30m 반경) + 지번번호 매칭
  const d = 0.0003;
  const bbox = `BOX(${lng - d},${lat - d},${lng + d},${lat + d})`;
  const feats = await wfsQuery({
    geomFilter: bbox,
    size: '30',
  }, key);
  if (feats.length === 0) throw new Error('폴리곤 없음');

  // 지번 문자열에서 본번·부번 추출 (예: "산205-3" → 산 205 3)
  const lotMatch = parcel.lot.match(/^(산)?(\d+)(?:-(\d+))?$/);
  if (lotMatch) {
    const [, san, jibun, bu] = lotMatch;
    const jibunNum = parseInt(jibun, 10);
    const buNum = bu ? parseInt(bu, 10) : 0;
    const isSan = san === '산';
    const match = feats.find(f => {
      const p = f.properties || {};
      return parseInt(p.jibun || 0, 10) === jibunNum
          && parseInt(p.bonbun || 0, 10) === jibunNum
          && parseInt(p.bubun || 0, 10) === buNum;
    });
    if (match) return match;
    // feature 속성 이름이 다를 수 있으니 PNU 후미 비교로 시도
    const suffix = `${isSan ? '2' : '1'}${String(jibunNum).padStart(4, '0')}${String(buNum).padStart(4, '0')}`;
    const byPnu = feats.find(f => (f.properties?.pnu || '').endsWith(suffix));
    if (byPnu) return byPnu;
  }
  // 마지막: 점에서 가장 가까운 폴리곤
  return feats[0];
}

// ==================== 전체 로드 ====================
async function loadAllParcels(key) {
  const total = window.PARCELS.length;
  let done = 0;
  let success = 0;
  const allBounds = [];

  updateProgress(0, total, '필지 로드 시작...');

  // 동시 2개씩 (VWorld 레이트리밋 고려)
  const concurrency = 2;
  const queue = [...window.PARCELS];

  async function worker() {
    while (queue.length > 0) {
      const parcel = queue.shift();
      if (!parcel) break;
      try {
        const pt = await geocodeParcel(parcel, key);
        const feature = await fetchParcelPolygon(pt, parcel, key);
        renderParcel(parcel, feature, allBounds);
        success++;
      } catch (e) {
        console.warn(`필지 ${parcel.no} (${parcel.lot}) 실패:`, e.message);
        markParcelStatus(parcel.no, 'failed');
      }
      done++;
      updateProgress(done, total, `로드 중 ${done}/${total} (성공 ${success})`);
    }
  }

  await Promise.all(Array.from({length: concurrency}, () => worker()));

  updateProgress(total, total, `완료: ${success}/${total}필지 표시됨`);
  document.getElementById('count').textContent = `(${success}/${total})`;

  // 저장된 스타일(단일색 등) 최종 반영
  applyLeafletParcelStyle();

  if (allBounds.length > 0) {
    const bounds = L.latLngBounds(allBounds.flat());
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function updateProgress(done, total, text) {
  document.getElementById('progress-text').textContent = text;
  document.getElementById('progress-bar-fill').style.width = `${(done/total)*100}%`;
}

// ==================== 렌더링 ====================
function renderParcel(parcel, feature, allBounds) {
  // 3D 뷰에서도 재사용할 수 있게 Cesium 에 등록
  if (window.CesiumApp) window.CesiumApp.register(parcel, feature);

  const color = parcelColorFor(parcel);

  const geojson = L.geoJSON(feature, {
    style: {
      color: color,
      weight: leafletParcelStyle.outline ? leafletParcelStyle.outlineWidth : 0,
      opacity: leafletParcelStyle.outline ? 0.95 : 0,
      fillColor: color,
      fillOpacity: leafletParcelStyle.fill ? leafletParcelStyle.alpha : 0,
    }
  });

  const polygon = geojson.getLayers()[0];
  polygon.bindPopup(buildPopup(parcel, feature));
  polygon.on('click', () => {
    document.querySelectorAll('.parcel-item').forEach(el => el.classList.remove('active'));
    const li = document.querySelector(`.parcel-item[data-no="${parcel.no}"]`);
    if (li) li.classList.add('active');
  });
  polygon.addTo(map);

  // 지번 라벨 (중심점에)
  const center = polygon.getBounds().getCenter();
  const label = L.marker(center, {
    icon: L.divIcon({
      className: 'parcel-label',
      html: `${parcel.lot}`,
      iconSize: [60, 16],
      iconAnchor: [30, 8],
    }),
    interactive: false,
  });
  if (document.getElementById('toggle-labels').checked) {
    label.addTo(map);
  }

  polygonsById[parcel.no] = { polygon, label, parcel };
  allBounds.push(polygon.getBounds());
  resolvedParcels.push(parcel);
}

function buildPopup(parcel, feature) {
  const props = feature.properties || {};
  return `
    <div class="popup-title">${parcel.location} ${parcel.lot}</div>
    <div class="popup-row"><strong>No.</strong><span>${parcel.no}</span></div>
    <div class="popup-row"><strong>지목</strong><span>${parcel.category}</span></div>
    <div class="popup-row"><strong>면적</strong><span>${parcel.area_m2.toLocaleString()}㎡ (${parcel.area_pyeong.toLocaleString()}평)</span></div>
    <div class="popup-row"><strong>소유자</strong><span>${parcel.owner} <small>(${parcel.memo})</small></span></div>
    ${props.pnu ? `<div class="popup-row"><strong>PNU</strong><span style="font-family:monospace;font-size:11px">${props.pnu}</span></div>` : ''}
  `;
}

// ==================== 시작 ====================
document.addEventListener('DOMContentLoaded', init);
