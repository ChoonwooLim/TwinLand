// TwinLand - 기본 지번 데이터 (DATA/전체지번.png 기준 41필지)
// 소재지: 경기도 여주시 북내면 상교리
// 총면적: 316,270 m² (≈ 95,672 평)
// 28번(384-18, 85,677㎡) · 40번(산31, 41,847㎡) = 주)경기녹화조경 소유 핵심 필지
// 사용자가 editor 모달에서 추가/수정 가능 (localStorage 저장).

const PARCELS_STORAGE_KEY = 'twinland_custom_parcels';
const PREFIX_STORAGE_KEY = 'twinland_address_prefix';

window.DEFAULT_ADDRESS_PREFIX = '경기도 여주시 북내면';
window.DEFAULT_PARCELS = [
  // ── 일반 지번 (27필지) ──
  { no:  1, location: '상교리', lot: '375-1',  category: '전',   area_m2:    99, area_pyeong:    30, owner: '—', memo: '' },
  { no:  2, location: '상교리', lot: '383-1',  category: '임야', area_m2:   528, area_pyeong:   160, owner: '—', memo: '' },
  { no:  3, location: '상교리', lot: '384-4',  category: '대',   area_m2:   600, area_pyeong:   182, owner: '—', memo: '' },
  { no:  4, location: '상교리', lot: '384-5',  category: '임야', area_m2:   611, area_pyeong:   185, owner: '—', memo: '' },
  { no:  5, location: '상교리', lot: '384-10', category: '임야', area_m2: 15092, area_pyeong:  4565, owner: '—', memo: '' },
  { no:  6, location: '상교리', lot: '384-11', category: '도로', area_m2:   750, area_pyeong:   227, owner: '—', memo: '' },
  { no:  7, location: '상교리', lot: '384-12', category: '대',   area_m2:   998, area_pyeong:   302, owner: '—', memo: '' },
  { no:  8, location: '상교리', lot: '384-13', category: '임야', area_m2:  4987, area_pyeong:  1509, owner: '—', memo: '' },
  { no:  9, location: '상교리', lot: '384-14', category: '임야', area_m2:   806, area_pyeong:   244, owner: '—', memo: '' },
  { no: 10, location: '상교리', lot: '384-15', category: '임야', area_m2:   806, area_pyeong:   244, owner: '—', memo: '' },
  { no: 11, location: '상교리', lot: '384-16', category: '임야', area_m2:  2418, area_pyeong:   731, owner: '—', memo: '' },
  { no: 12, location: '상교리', lot: '384-17', category: '임야', area_m2:  1240, area_pyeong:   375, owner: '—', memo: '' },
  { no: 13, location: '상교리', lot: '384-25', category: '임야', area_m2:   249, area_pyeong:    75, owner: '—', memo: '' },
  { no: 14, location: '상교리', lot: '384-26', category: '임야', area_m2:  2503, area_pyeong:   757, owner: '—', memo: '' },
  { no: 15, location: '상교리', lot: '385',    category: '전',   area_m2:   185, area_pyeong:    56, owner: '—', memo: '' },
  { no: 16, location: '상교리', lot: '452',    category: '전',   area_m2:  5716, area_pyeong:  1729, owner: '—', memo: '' },
  { no: 17, location: '상교리', lot: '452-1',  category: '전',   area_m2:   362, area_pyeong:   110, owner: '—', memo: '' },
  { no: 18, location: '상교리', lot: '452-2',  category: '도로', area_m2:    95, area_pyeong:    29, owner: '—', memo: '' },
  { no: 19, location: '상교리', lot: '452-5',  category: '도로', area_m2:    75, area_pyeong:    23, owner: '—', memo: '' },
  { no: 20, location: '상교리', lot: '462',    category: '도로', area_m2:   341, area_pyeong:   103, owner: '—', memo: '' },
  { no: 21, location: '상교리', lot: '463',    category: '전',   area_m2:   382, area_pyeong:   116, owner: '—', memo: '' },
  { no: 22, location: '상교리', lot: '463-1',  category: '구거', area_m2:   457, area_pyeong:   138, owner: '—', memo: '검증 필요 (이미지 흐림)' },
  { no: 23, location: '상교리', lot: '464',    category: '전',   area_m2:  2556, area_pyeong:   773, owner: '—', memo: '' },
  { no: 24, location: '상교리', lot: '465',    category: '도로', area_m2:   823, area_pyeong:   249, owner: '—', memo: '' },
  { no: 25, location: '상교리', lot: '466',    category: '유지', area_m2:   410, area_pyeong:   124, owner: '—', memo: '' },
  { no: 26, location: '상교리', lot: '467',    category: '대',   area_m2:   702, area_pyeong:   212, owner: '—', memo: '검증 필요 (이미지 흐림)' },
  { no: 27, location: '상교리', lot: '452-4',  category: '전',   area_m2:  1150, area_pyeong:   348, owner: '—', memo: '' },
  // ── 핵심 필지 (주)경기녹화조경) ──
  { no: 28, location: '상교리', lot: '384-18', category: '임야', area_m2: 85677, area_pyeong: 25917, owner: '주)경기녹화조경', memo: 'DATA/ 보고서 샘플 (8.57 ha)' },
  // ── 일반 지번 (계속) ──
  { no: 29, location: '상교리', lot: '384-19', category: '임야', area_m2:  1110, area_pyeong:   336, owner: '—', memo: '' },
  { no: 30, location: '상교리', lot: '384-20', category: '유원지', area_m2: 3272, area_pyeong:   990, owner: '—', memo: '지목 검증 필요' },
  { no: 31, location: '상교리', lot: '384-21', category: '임야', area_m2: 16160, area_pyeong:  4888, owner: '—', memo: '' },
  { no: 32, location: '상교리', lot: '384-22', category: '임야', area_m2:   126, area_pyeong:    38, owner: '—', memo: '' },
  { no: 33, location: '상교리', lot: '384-23', category: '임야', area_m2:  7332, area_pyeong:  2218, owner: '—', memo: '' },
  // ── 산지 (8필지) ──
  { no: 34, location: '상교리', lot: '산29',   category: '임야', area_m2: 29130, area_pyeong:  8812, owner: '—', memo: '' },
  { no: 35, location: '상교리', lot: '산29-1', category: '임야', area_m2:  9917, area_pyeong:  3000, owner: '—', memo: '' },
  { no: 36, location: '상교리', lot: '산29-2', category: '임야', area_m2:  6617, area_pyeong:  2002, owner: '—', memo: '' },
  { no: 37, location: '상교리', lot: '산29-3', category: '임야', area_m2:   826, area_pyeong:   250, owner: '—', memo: '' },
  { no: 38, location: '상교리', lot: '산29-4', category: '임야', area_m2:  1113, area_pyeong:   337, owner: '—', memo: '' },
  { no: 39, location: '상교리', lot: '383-8',  category: '임야', area_m2:   660, area_pyeong:   200, owner: '—', memo: '산 prefix 검증 필요' },
  { no: 40, location: '상교리', lot: '산31',   category: '임야', area_m2: 41847, area_pyeong: 12659, owner: '주)경기녹화조경', memo: 'DATA/ 보고서 샘플 (4.18 ha)' },
  { no: 41, location: '상교리', lot: '산31-1', category: '임야', area_m2: 67541, area_pyeong: 20431, owner: '—', memo: '' },
];

// 저장된 커스텀 필지 로드 → window.PARCELS / window.ADDRESS_PREFIX 세팅
(function loadStoredParcels() {
  try {
    const raw = localStorage.getItem(PARCELS_STORAGE_KEY);
    // 키가 있으면 빈 배열이라도 그대로 사용(의도적 빈 프로젝트). 키 자체가 없을 때만 기본 41필지.
    const arr = raw != null ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) {
      window.PARCELS = arr;
      window._USING_CUSTOM_PARCELS = arr.length > 0;
    } else {
      window.PARCELS = window.DEFAULT_PARCELS;
    }
  } catch (e) {
    console.warn('[parcels] 저장된 필지 로드 실패, 기본값 사용:', e.message);
    window.PARCELS = window.DEFAULT_PARCELS;
  }
  window.ADDRESS_PREFIX = localStorage.getItem(PREFIX_STORAGE_KEY) || window.DEFAULT_ADDRESS_PREFIX;
})();

window.saveCustomParcels = function(parcels, prefix) {
  localStorage.setItem(PARCELS_STORAGE_KEY, JSON.stringify(parcels));
  if (prefix) localStorage.setItem(PREFIX_STORAGE_KEY, prefix);
};

window.resetParcelsToDefault = function() {
  localStorage.removeItem(PARCELS_STORAGE_KEY);
  localStorage.removeItem(PREFIX_STORAGE_KEY);
};

// 주소 문자열 생성 (VWorld geocoder 용)
window.buildAddress = function(parcel) {
  return `${window.ADDRESS_PREFIX} ${parcel.location} ${parcel.lot}`;
};

// 지목별 색상 (위성 이미지 가시성 고려)
window.CATEGORY_COLORS = {
  '전':     '#f9a825',  // 전(田) - 주황/황토
  '답':     '#1976d2',  // 답(畓) - 파랑
  '대':     '#ffeb3b',  // 대(垈) - 노랑
  '임':     '#00e676',  // 임(林) - 밝은 연두
  '임야':   '#e91e63',  // 임야 - 핫핑크/마젠타 (산지 잘 보이도록)
  '도로':   '#9e9e9e',  // 도로 - 회색
  '구거':   '#26c6da',  // 구거 - 시안
  '유지':   '#3949ab',  // 유지 - 남색
  '유원지': '#ab47bc',  // 유원지 - 보라
};

// 소유자별 색상 (필터용 — 사용자가 editor 모달에서 채울 때 자동 매칭)
window.OWNER_COLORS = {
  '주)경기녹화조경': '#d32f2f',
};
