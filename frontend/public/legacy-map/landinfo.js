// JooJoo Land - 토지 상세 정보 모달
// 지목/소유자/면적 집계 + 산지 정보 + 외부 조회 링크

(function () {
  const MODAL_ID = 'landinfo-modal';
  const BODY_ID  = 'landinfo-body';

  // ==================== 숫자 포맷 ====================
  const fmt   = (n) => n.toLocaleString('ko-KR');
  const fmt1  = (n) => n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // ==================== 집계 ====================
  function aggregate(parcels) {
    const total = {
      count: parcels.length,
      m2:    parcels.reduce((s, p) => s + (p.area_m2 || 0), 0),
      pyeong: parcels.reduce((s, p) => s + (p.area_pyeong || 0), 0),
    };
    const byCategory = {};  // { '전': { count, m2, pyeong, parcels: [] } ... }
    const byOwner    = {};
    parcels.forEach((p) => {
      const c = p.category || '기타';
      const o = p.owner || '미상';
      byCategory[c] = byCategory[c] || { count: 0, m2: 0, pyeong: 0, parcels: [] };
      byOwner[o]    = byOwner[o]    || { count: 0, m2: 0, pyeong: 0, parcels: [] };
      byCategory[c].count++;   byCategory[c].m2 += p.area_m2 || 0;   byCategory[c].pyeong += p.area_pyeong || 0;   byCategory[c].parcels.push(p);
      byOwner[o].count++;      byOwner[o].m2    += p.area_m2 || 0;   byOwner[o].pyeong    += p.area_pyeong || 0;    byOwner[o].parcels.push(p);
    });
    return { total, byCategory, byOwner };
  }

  // ==================== 산지 분석 ====================
  function classifyForest(parcel) {
    // 산X-Y 형태 지번 → 임야(산지), 그 외 임은 일반 임
    const lot = parcel.lot || '';
    const isSan = /^산/.test(lot);
    const cat  = parcel.category || '';
    if (cat === '임야' || isSan) return 'forest_mountain';    // 임야(산지) — 보전/준보전 판정 대상
    if (cat === '임') return 'forest_flat';                    // 임(평지 임)
    return null;
  }

  function forestParcels(parcels) {
    return parcels.filter(p => classifyForest(p));
  }

  // ==================== 외부 조회 딥링크 ====================
  // 산지정보시스템 — 주소 검색 파라미터 미공개라 홈으로 이동
  // 다드림 — 주소 검색이 내장. 기본 URL 에 주소를 넘겨도 페이지 내부에서 재검색 필요할 수 있음.
  function dadreemLink(parcel) {
    // 다드림 메인 (필지별 서비스) — 사용자가 주소 입력 후 조회
    return 'https://gis.kofpi.or.kr/dad_user/mapService/filjiInfoService/view.do';
  }
  function forestlandLink(parcel) {
    return 'http://www.forestland.go.kr/';
  }
  function fgisLink() {
    return 'https://map.forest.go.kr/';
  }
  // VWorld 부동산 정보 조회 — 주소로 직행 링크
  function vworldSearchLink(parcel) {
    const prefix = window.ADDRESS_PREFIX || '경기도 양평군 양동면';
    const addr = encodeURIComponent(`${prefix} ${parcel.location || ''} ${parcel.lot || ''}`.trim());
    return `https://map.vworld.kr/map.do?query=${addr}`;
  }

  // ==================== 카드/테이블 렌더 ====================
  function sectionCard(title, subtitle, bodyHtml) {
    return `
      <section class="linfo-section">
        <div class="linfo-section-head">
          <h3>${title}</h3>
          ${subtitle ? `<small>${subtitle}</small>` : ''}
        </div>
        <div class="linfo-section-body">${bodyHtml}</div>
      </section>
    `;
  }

  function statRow(label, value, unit = '', accent = false) {
    return `<div class="linfo-stat ${accent ? 'accent' : ''}">
      <span class="linfo-stat-label">${label}</span>
      <span class="linfo-stat-value">${value}<small>${unit}</small></span>
    </div>`;
  }

  function categoryTable(byCategory, totalArea) {
    const order = ['전', '답', '임', '임야', '대'];
    const rows = order
      .filter(c => byCategory[c])
      .concat(Object.keys(byCategory).filter(c => !order.includes(c)))
      .map(cat => {
        const s = byCategory[cat];
        const color = (window.CATEGORY_COLORS || {})[cat] || '#9e9e9e';
        const pct = totalArea > 0 ? (s.m2 / totalArea) * 100 : 0;
        return `<tr>
          <td><span class="linfo-swatch" style="background:${color}"></span>${cat}</td>
          <td class="num">${s.count}</td>
          <td class="num">${fmt(s.m2)}</td>
          <td class="num">${fmt(s.pyeong)}</td>
          <td class="num">${fmt1(pct)}%</td>
          <td><div class="linfo-bar"><div class="linfo-bar-fill" style="width:${pct}%;background:${color}"></div></div></td>
        </tr>`;
      }).join('');
    return `<table class="linfo-table">
      <thead><tr><th>지목</th><th class="num">필지</th><th class="num">㎡</th><th class="num">평</th><th class="num">비율</th><th>분포</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function ownerTable(byOwner, totalArea) {
    const owners = Object.keys(byOwner).sort((a, b) => byOwner[b].m2 - byOwner[a].m2);
    const rows = owners.map(o => {
      const s = byOwner[o];
      const color = (window.OWNER_COLORS || {})[o] || '#607d8b';
      const pct = totalArea > 0 ? (s.m2 / totalArea) * 100 : 0;
      return `<tr>
        <td><span class="linfo-swatch" style="background:${color}"></span>${o}</td>
        <td class="num">${s.count}</td>
        <td class="num">${fmt(s.m2)}</td>
        <td class="num">${fmt(s.pyeong)}</td>
        <td class="num">${fmt1(pct)}%</td>
        <td><div class="linfo-bar"><div class="linfo-bar-fill" style="width:${pct}%;background:${color}"></div></div></td>
      </tr>`;
    }).join('');
    return `<table class="linfo-table">
      <thead><tr><th>소유자</th><th class="num">필지</th><th class="num">㎡</th><th class="num">평</th><th class="num">비율</th><th>분포</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ==================== 산림 API (백엔드 SHP 분석) ====================
  let _forestStatus = null;           // { loaded_layers: {...}, ready: bool }
  let _forestBatchResult = null;      // analyze-batch 응답
  let _nearbyPoiResult = null;        // nearby-poi 응답

  async function fetchForestStatus() {
    try {
      const r = await fetch('/api/forest/status');
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function fetchForestBatch() {
    // 로드된 필지만 geometry 전달
    const items = [];
    const polyMap = window.polygonsById || {};
    Object.entries(polyMap).forEach(([no, entry]) => {
      const f = entry?.polygon?.feature;
      if (!f || !f.geometry) return;
      items.push({
        parcel_no: parseInt(no, 10),
        geometry: f.geometry,
        layers: ['imsang', 'sanji', 'landslide', 'soil', 'productivity',
                 'forest_function', 'state_forest', 'private_forest'],
      });
    });
    if (items.length === 0) return null;
    try {
      const r = await fetch('/api/forest/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: items }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  let _roadsResult = null;
  async function fetchForestRoads() {
    const items = [];
    Object.values(window.polygonsById || {}).forEach(entry => {
      const f = entry?.polygon?.feature;
      if (f && f.geometry) items.push(f.geometry);
    });
    if (items.length === 0) return null;
    try {
      const r = await fetch('/api/forest/forest-roads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: items, radius_m: 2000, limit: 30 }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  let _slopeResult = null;   // 네이밍 그대로(산사태위험 결과 담음)
  async function fetchSlope() {
    const items = [];
    Object.values(window.polygonsById || {}).forEach(entry => {
      const f = entry?.polygon?.feature;
      if (f && f.geometry) items.push(f.geometry);
    });
    if (items.length === 0) return null;
    try {
      // 새 엔드포인트 /landslide-batch. 옛 /slope-batch 도 alias 로 유지.
      const r = await fetch('/api/forest/landslide-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: items }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function fetchNearbyPoi(radiusM = 3000) {
    const items = [];
    const polyMap = window.polygonsById || {};
    Object.values(polyMap).forEach(entry => {
      const f = entry?.polygon?.feature;
      if (f && f.geometry) items.push(f.geometry);
    });
    if (items.length === 0) return null;
    try {
      const r = await fetch('/api/forest/nearby-poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: items, radius_m: radiusM, limit: 500 }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  function renderProjectSummary(ps) {
    if (!ps || Object.keys(ps).length === 0) return '';
    const labelMap = {
      imsang: '🌲 임상 분포',
      sanji: '⛰️ 산지 구분',
      landslide: '⚠️ 산사태 위험',
      soil: '🌱 산림입지 (토양·모암)',
      productivity: '🌳 임지 생산능력',
      forest_function: '🎯 산림기능 (휴양·보전·수자원 등)',
      state_forest: '🏛️ 국유림 경제림 인접',
      private_forest: '🌲 사유림 경제림 인접',
      public_forest: '🏢 공유림 인접',  // 옛 이름 호환
    };
    const blocks = Object.entries(ps).map(([layer, items]) => {
      if (!items || items.length === 0) return '';
      const rows = items.map(it => `<tr>
        <td>${it.category}</td>
        <td class="num">${fmt(Math.round(it.area_m2))}</td>
        <td class="num">${fmt(Math.round(it.area_pyeong))}</td>
        <td class="num">${fmt(it.parcel_count)}</td>
      </tr>`).join('');
      return `
        <div class="linfo-subsection" style="margin-top:10px;">
          <h4 style="margin:8px 0 6px;font-size:13px;color:var(--text-primary);">${labelMap[layer] || layer}</h4>
          <table class="linfo-table">
            <thead><tr><th>분류</th><th class="num">㎡</th><th class="num">평</th><th class="num">필지수</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join('');
    return `<div class="linfo-forest-project">${blocks}</div>`;
  }

  function roadsSection() {
    if (!_forestStatus) return `<p class="linfo-hint">조회 중...</p>`;
    const has = (_forestStatus.loaded_layers || {}).forest_road > 0;
    if (!has) {
      return `<div class="linfo-notice">
        <strong>ℹ️ 임도망 미적재</strong> — <code>--layer forest_road</code> 적재 후 표시.
      </div>`;
    }
    if (!_roadsResult) return `<p class="linfo-hint">반경 2km 임도 계산 중...</p>`;
    const r = _roadsResult;
    if (!r.total) {
      return `<p class="linfo-hint">반경 ${Math.round(r.radius_m)}m 내 임도 없음</p>`;
    }
    const n = r.nearest || {};
    const rows = (r.roads || []).slice(0, 15).map(rd => `<tr>
      <td class="num">${fmt(Math.round(rd.distance_m))}m</td>
      <td>${rd.name || '-'}</td>
      <td class="num">${fmt(Math.round(rd.length_m))}m</td>
      <td><small>${rd.category || ''}</small></td>
      <td><small>${rd.intersects_parcel ? '<b style="color:#4caf50">통과</b>' : '-'}</small></td>
    </tr>`).join('');
    return `
      <div class="linfo-stats-grid">
        ${statRow('반경 2km 임도', fmt(r.total), '개', true)}
        ${statRow('필지 관통', fmt(r.intersecting || 0), '개')}
        ${statRow('최근접 거리', fmt(Math.round(n.distance_m || 0)), 'm', true)}
      </div>
      <p class="linfo-hint" style="margin-top:10px;">
        <b>최근접 임도</b>: ${n.name || '(이름없음)'}
        — 거리 ${fmt(Math.round(n.distance_m || 0))}m
        (길이 ${fmt(Math.round(n.length_m || 0))}m, 폭 ${n.width_m || '?'}m,
        ${n.year ? n.year + '년 준공' : '연도 미상'})
      </p>
      <table class="linfo-table">
        <thead><tr><th class="num">거리</th><th>임도명</th><th class="num">길이</th><th>구분</th><th>통과</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function slopeSection() {
    // 산사태위험 래스터 분석. 래스터 데이터는 DATA016 = 산사태위험지도.
    // 함수명은 하위호환상 slopeSection 유지 (섹션 라벨에서 '산사태위험' 로 표기).
    if (!_forestStatus) return `<p class="linfo-hint">조회 중...</p>`;
    const ready = _forestStatus.landslide_raster_ready ?? _forestStatus.slope_raster_ready;
    if (!ready) {
      return `<div class="linfo-notice">
        <strong>ℹ️ 산사태위험 래스터 미설정</strong> — 환경변수 <code>LANDSLIDE_RASTER_PATH</code> 에 GeoTIFF 경로 지정 필요.
      </div>`;
    }
    if (!_slopeResult) return `<p class="linfo-hint">산사태위험 zonal stats 계산 중...</p>`;
    const r = _slopeResult;
    if (!r.items || r.items.length === 0) return `<p class="linfo-hint">데이터 없음</p>`;
    // 산림청 산사태위험등급: 1=매우높음(빨강) ~ 5=매우낮음(초록). 색상 반전.
    const colorByGrade = { 1: '#f44336', 2: '#ff9800', 3: '#ffc107', 4: '#8bc34a', 5: '#4caf50' };
    const rows = r.items.map(it => {
      const hueClass = it.grade >= 4 ? 'accent' : '';
      return `<tr class="${hueClass}">
        <td><strong>${it.grade}</strong> ${it.label}</td>
        <td class="num">${fmt(Math.round(it.area_m2))}</td>
        <td class="num">${fmt(Math.round(it.area_pyeong))}</td>
        <td class="num">${it.pct}%</td>
        <td><div class="linfo-bar"><div class="linfo-bar-fill" style="width:${it.pct}%;background:${colorByGrade[it.grade] || '#999'}"></div></div></td>
      </tr>`;
    }).join('');
    // 안전 비율 (4-5 등급 = 낮음/매우낮음 합)
    const safe = r.items.filter(x => x.grade >= 4).reduce((s, x) => s + x.area_m2, 0);
    const safePct = r.total_area_m2 > 0 ? (safe / r.total_area_m2 * 100) : 0;
    return `
      <div class="linfo-stats-grid">
        ${statRow('분석 면적', fmt(Math.round(r.total_area_m2)), '㎡', true)}
        ${statRow('픽셀 해상도', `${r.pixel_size_m}`, 'm')}
        ${statRow('안전 구간 (4~5등급)', fmt1(safePct), '%', true)}
      </div>
      <table class="linfo-table" style="margin-top:10px;">
        <thead><tr><th>등급</th><th class="num">㎡</th><th class="num">평</th><th class="num">비율</th><th>분포</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="linfo-hint">산림청 산사태위험등급: 1=매우높음 ~ 5=매우낮음. 4~5등급이 낮은 위험 구간.</p>
    `;
  }

  function poiSection() {
    if (!_forestStatus) return `<p class="linfo-hint">조회 중...</p>`;
    const hasPoi = (_forestStatus.loaded_layers || {}).mountain_poi > 0;
    if (!hasPoi) {
      return `<div class="linfo-notice">
        <strong>ℹ️ 등산로 포인트 미적재</strong> — 적재 명령:
        <code>python -m backend.scripts.ingest_mountain_poi --source-dir /data/forest/mountain_poi --truncate</code>
      </div>`;
    }
    if (!_nearbyPoiResult) return `<p class="linfo-hint">주변 POI 계산 중...</p>`;
    const res = _nearbyPoiResult;
    if (!res.total) return `<p class="linfo-hint">반경 ${Math.round(res.radius_m)}m 내 POI 없음</p>`;

    const catChips = (res.by_category || []).map(c =>
      `<span class="linfo-chip">${c.category} <b>${c.count}</b></span>`
    ).join(' ');

    const rows = (res.points || []).slice(0, 50).map(p => `<tr>
      <td class="num">${fmt(Math.round(p.distance_m))}m</td>
      <td>${p.name || '-'}</td>
      <td><span class="linfo-chip">${p.category}</span></td>
      <td><small>${p.detail || ''}</small></td>
    </tr>`).join('');

    return `
      <div class="linfo-stats-grid">
        ${statRow('반경', fmt(Math.round(res.radius_m)), 'm', true)}
        ${statRow('주변 POI 총수', fmt(res.total), '개', true)}
        ${statRow('카테고리 종', fmt((res.by_category || []).length), '종')}
      </div>
      <div style="margin:10px 0;">${catChips}</div>
      <div class="linfo-scroll-table">
        <table class="linfo-table">
          <thead><tr><th class="num">거리</th><th>산/지점명</th><th>분류</th><th>상세</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${res.total > 50 ? `<p class="linfo-hint">최대 50 개만 표시. 전체 ${fmt(res.total)} 개.</p>` : ''}
      <p class="linfo-hint">지도 사이드바 <b>🥾 등산 인프라</b> 토글로 지도상 마커 확인 가능.</p>
    `;
  }

  function forestApiSection() {
    if (!_forestStatus) return `<p class="linfo-hint">산림 데이터셋 상태 조회 중...</p>`;
    if (!_forestStatus.ready) {
      return `
        <div class="linfo-notice">
          <strong>ℹ️ SHP 미적재</strong>: 서버에 산림청 SHP 데이터가 아직 올라가지 않았습니다.
          관리자가 <code>ingest_forest_shp.py</code> 스크립트로 적재해야 계산값이 표시됩니다.
          그 전까지는 아래 외부 링크로 개별 조회하세요.
        </div>`;
    }
    const layers = _forestStatus.loaded_layers || {};
    const chips = Object.entries(layers).map(([k, v]) => `<span class="linfo-chip">${k}: ${fmt(v)}건</span>`).join(' ');
    let body = `<p class="linfo-hint">적재 레이어: ${chips}</p>`;
    if (_forestBatchResult && _forestBatchResult.project_summary) {
      body += renderProjectSummary(_forestBatchResult.project_summary);
    }
    return body;
  }

  function forestSection(parcels) {
    const forests = forestParcels(parcels);
    if (forests.length === 0) {
      return `<p class="linfo-hint">임/임야 필지가 없습니다.</p>`;
    }
    const total = forests.reduce((s, p) => s + (p.area_m2 || 0), 0);
    const totalPyeong = forests.reduce((s, p) => s + (p.area_pyeong || 0), 0);
    const mountain = forests.filter(p => classifyForest(p) === 'forest_mountain');

    const stats = `
      <div class="linfo-stats-grid">
        ${statRow('산지 필지 총수', fmt(forests.length), '건', true)}
        ${statRow('산지 면적 합계', fmt(total), '㎡')}
        ${statRow('평수', fmt(totalPyeong), '평')}
        ${statRow('헥타르', fmt1(total / 10000), 'ha')}
        ${statRow('임야(산지) 필지', fmt(mountain.length), '건')}
      </div>
    `;

    const rows = forests.map(p => {
      const mtn = classifyForest(p) === 'forest_mountain';
      return `<tr>
        <td>${p.no}</td>
        <td>${p.location} <strong>${p.lot}</strong> <span class="linfo-chip">${p.category}</span> ${mtn ? '<span class="linfo-chip linfo-chip-mtn">산지</span>' : ''}</td>
        <td class="num">${fmt(p.area_m2)}㎡<br><small>${fmt(p.area_pyeong)}평</small></td>
        <td>${p.owner || '-'}</td>
        <td class="linfo-links">
          <a href="${dadreemLink(p)}" target="_blank" rel="noopener" title="경사·임상·토양·산사태 통합 조회">다드림</a>
          <a href="${forestlandLink(p)}" target="_blank" rel="noopener" title="보전/준보전 산지 판정">산지정보</a>
          <a href="${vworldSearchLink(p)}" target="_blank" rel="noopener" title="VWorld 지도 상세">VWorld</a>
        </td>
      </tr>`;
    }).join('');

    const table = `<table class="linfo-table linfo-forest-table">
      <thead><tr><th>No</th><th>지번·지목</th><th>면적</th><th>소유</th><th>외부 조회</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

    const note = `
      <div class="linfo-notice">
        <strong>ℹ️ 보전/준보전 산지 구분:</strong> 정확한 <b>보전산지·준보전산지·임업용산지·공익용산지</b> 판정은
        <b>산지정보시스템(forestland.go.kr)</b> 또는 <b>임업정보 다드림</b> 에서 필지별로 조회해야 합니다.
        (VWorld 공개 API 에는 산지구분 속성이 노출되지 않음.)
        아래 <b>외부 조회</b> 버튼을 누르면 해당 서비스로 이동합니다.
      </div>
    `;

    return stats + table + note;
  }

  function adjacentSection() {
    const groups = window.adjacentLayerGroups || {};
    const featureMap = window.adjacentFeaturesByType || {};
    const labels = {
      road: '도로',
      ditch: '구거',
      river: '하천·제방·유지',
      public: '국공유지',
      military: '군유지',
    };
    const rows = Object.keys(labels).map(type => {
      const features = featureMap[type];
      const active = Boolean(groups[type]);
      const count = features ? features.length : 0;
      const area  = features ? features.reduce((s, f) => s + (f.properties?.area ? parseFloat(f.properties.area) : 0), 0) : 0;
      return `<tr>
        <td><span class="linfo-dot ${active ? 'on' : ''}"></span>${labels[type]}</td>
        <td class="num">${active ? fmt(count) + '건' : '<small>-</small>'}</td>
        <td class="num">${active && area > 0 ? fmt(Math.round(area)) + '㎡' : '<small>-</small>'}</td>
        <td><small>${active ? '활성' : '사이드바에서 체크'}</small></td>
      </tr>`;
    }).join('');
    return `<table class="linfo-table">
      <thead><tr><th>레이어</th><th class="num">필지수</th><th class="num">면적 합계</th><th>상태</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="linfo-hint">면적 합계는 VWorld 응답에 area 속성이 포함될 때만 표시됩니다.</p>`;
  }

  function externalLinksSection(parcels) {
    return `
      <div class="linfo-ext-grid">
        <a class="linfo-ext-card" href="https://gis.kofpi.or.kr/" target="_blank" rel="noopener">
          <strong>🌲 임업정보 다드림</strong>
          <small>주소 입력 한 번으로 경사·임상·토양·산사태·지형·기후 통합 조회. 한글/PDF 보고서 저장.</small>
        </a>
        <a class="linfo-ext-card" href="https://map.forest.go.kr/" target="_blank" rel="noopener">
          <strong>🗺️ FGIS 산림공간정보</strong>
          <small>임상도·산림입지토양도·산지구분도·임도망·맞춤형 조림지도 지도 레이어.</small>
        </a>
        <a class="linfo-ext-card" href="http://www.forestland.go.kr/" target="_blank" rel="noopener">
          <strong>⛰️ 산지정보시스템</strong>
          <small>보전/준보전산지·임업용산지·공익용산지 판정. 산지전용 허가 가능성 확인.</small>
        </a>
        <a class="linfo-ext-card" href="https://www.eum.go.kr/" target="_blank" rel="noopener">
          <strong>📋 토지e음</strong>
          <small>토지이용계획확인원·규제정보·공시지가·개발행위 가능여부.</small>
        </a>
        <a class="linfo-ext-card" href="https://www.onnara.go.kr/" target="_blank" rel="noopener">
          <strong>🏞️ 온나라 부동산정보</strong>
          <small>국토교통부 종합 부동산 정보 포털 — 공시가·실거래·규제.</small>
        </a>
        <a class="linfo-ext-card" href="https://map.vworld.kr/" target="_blank" rel="noopener">
          <strong>🌐 VWorld 지도</strong>
          <small>VWorld 공식 지도 — 지적·위성·3D·항공사진 레이어 종합.</small>
        </a>
      </div>
    `;
  }

  function parcelListSection(parcels) {
    const rows = parcels.map(p => {
      const color = (window.CATEGORY_COLORS || {})[p.category] || '#9e9e9e';
      return `<tr>
        <td>${p.no}</td>
        <td><span class="linfo-swatch" style="background:${color}"></span>${p.lot}</td>
        <td><span class="linfo-chip">${p.category}</span></td>
        <td class="num">${fmt(p.area_m2)}</td>
        <td class="num">${fmt(p.area_pyeong)}</td>
        <td>${p.owner || '-'}</td>
        <td><small>${p.memo || ''}</small></td>
      </tr>`;
    }).join('');
    return `<div class="linfo-scroll-table">
      <table class="linfo-table">
        <thead><tr><th>No</th><th>지번</th><th>지목</th><th class="num">㎡</th><th class="num">평</th><th>소유자</th><th>비고</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  // ==================== 메인 렌더 ====================
  function render() {
    const parcels = window.PARCELS || [];
    if (parcels.length === 0) {
      return `<p class="linfo-hint">필지 데이터가 없습니다.</p>`;
    }
    const agg = aggregate(parcels);
    const haTotal = agg.total.m2 / 10000;

    const summary = `
      <div class="linfo-stats-grid">
        ${statRow('총 필지수', fmt(agg.total.count), '건', true)}
        ${statRow('총 면적', fmt(agg.total.m2), '㎡')}
        ${statRow('평수', fmt(agg.total.pyeong), '평')}
        ${statRow('헥타르', fmt1(haTotal), 'ha', true)}
        ${statRow('지목 종류', fmt(Object.keys(agg.byCategory).length), '종')}
        ${statRow('소유자 수', fmt(Object.keys(agg.byOwner).length), '명')}
      </div>
    `;

    return [
      sectionCard('📌 총괄', '프로젝트 전체 수치', summary),
      sectionCard('🏷️ 지목 분포', '카테고리별 필지·면적·비율', categoryTable(agg.byCategory, agg.total.m2)),
      sectionCard('👥 소유자 분포', '소유자별 필지·면적·비율', ownerTable(agg.byOwner, agg.total.m2)),
      sectionCard('📐 산림 분석 (SHP 자체 계산)',
        '서버에 적재된 임상도·산림입지·임지생산능력과 교집합 실측',
        forestApiSection()),
      sectionCard('⚠️ 산사태위험등급 분포 (래스터)',
        '10m 해상도 산사태위험등급도와 교차 — 안전성 정량 평가',
        slopeSection()),
      sectionCard('🛣️ 임도 접근성',
        '반경 2km 내 임도 (산림청 FRRD) — 차량 접근성·시공 장비 반입 근거',
        roadsSection()),
      sectionCard('🥾 주변 등산 인프라',
        '반경 3km 내 산림청 등록 등산로 지점 (이정표·정상·갈림길·대피소 등)',
        poiSection()),
      sectionCard('🌲 산지·산림 정보', '임/임야 필지 + 보전/준보전 판정 외부 링크', forestSection(parcels)),
      sectionCard('🛣️ 인접 레이어 현황', '사이드바에서 켜둔 도로·구거·하천 등 집계', adjacentSection()),
      sectionCard('🔗 외부 공식 조회', '정확한 규제·경사·산지구분·공시지가 등은 아래 서비스에서 확인', externalLinksSection(parcels)),
      sectionCard('📋 필지 전체 리스트', `총 ${parcels.length}건`, parcelListSection(parcels)),
    ].join('');
  }

  // ==================== 모달 제어 ====================
  async function openModal() {
    const body = document.getElementById(BODY_ID);
    const modal = document.getElementById(MODAL_ID);
    if (!body || !modal) return;
    body.innerHTML = render();
    modal.classList.remove('hidden');
    // 백엔드 산림 분석: 비동기로 후속 업데이트
    if (!_forestStatus) _forestStatus = await fetchForestStatus();
    const layers = _forestStatus?.loaded_layers || {};
    const hasPolygon = layers.imsang || layers.sanji || layers.landslide;
    const hasPoi = layers.mountain_poi;
    if (hasPolygon && !_forestBatchResult) {
      _forestBatchResult = await fetchForestBatch();
    }
    if (hasPoi && !_nearbyPoiResult) {
      _nearbyPoiResult = await fetchNearbyPoi(3000);
    }
    const rasterReady = _forestStatus?.landslide_raster_ready ?? _forestStatus?.slope_raster_ready;
    if (rasterReady && !_slopeResult) {
      _slopeResult = await fetchSlope();
    }
    if ((layers.forest_road || 0) > 0 && !_roadsResult) {
      _roadsResult = await fetchForestRoads();
    }
    // 재렌더 (데이터 도착 후)
    body.innerHTML = render();
  }
  function closeModal() {
    document.getElementById(MODAL_ID)?.classList.add('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('open-landinfo')?.addEventListener('click', openModal);
    document.getElementById('landinfo-close')?.addEventListener('click', closeModal);
    document.getElementById(MODAL_ID)?.addEventListener('click', (e) => {
      if (e.target.id === MODAL_ID) closeModal();
    });
  });

  window.LandInfo = { open: openModal, close: closeModal };
})();
