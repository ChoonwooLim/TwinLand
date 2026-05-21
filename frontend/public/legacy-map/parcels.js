// TwinLand - 기본 지번 데이터 (DATA/ 폴더 샘플 보고서 기준 2필지)
// 소재지: 경기도 여주시 북내면 상교리
// 참조 보고서: DATA/필지분석결과서_..._384-18 (8.57 ha)
//            DATA/필지분석결과서_..._산 31 (4.18 ha)
// 사용자가 editor 모달에서 추가/삭제 가능 (localStorage 저장).

const PARCELS_STORAGE_KEY = 'twinland_custom_parcels';
const PREFIX_STORAGE_KEY = 'twinland_address_prefix';

window.DEFAULT_ADDRESS_PREFIX = '경기도 여주시 북내면';
window.DEFAULT_PARCELS = [
  { no: 1, location: '상교리', lot: '384-18', category: '임야', area_m2: 85700, area_pyeong: 25924, owner: '—', memo: 'DATA/필지분석결과서 샘플 (8.57 ha)' },
  { no: 2, location: '상교리', lot: '산31',   category: '임야', area_m2: 41800, area_pyeong: 12645, owner: '—', memo: 'DATA/필지분석결과서 샘플 (4.18 ha)' },
];

// 저장된 커스텀 필지 로드 → window.PARCELS / window.ADDRESS_PREFIX 세팅
(function loadStoredParcels() {
  try {
    const raw = localStorage.getItem(PARCELS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      window.PARCELS = arr;
      window._USING_CUSTOM_PARCELS = true;
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
  '전':   '#f9a825',  // 전(田) - 주황/황토
  '답':   '#1976d2',  // 답(畓) - 파랑
  '임':   '#00e676',  // 임(林) - 밝은 연두 (녹지 위에서 대비)
  '임야': '#e91e63',  // 임야    - 핫핑크/마젠타 (산지 잘 보이도록)
  '대':   '#ffeb3b',  // 대(垈) - 노랑
};

// 소유자별 색상 (필터용 — 사용자가 editor 모달에서 채울 때 자동 매칭)
window.OWNER_COLORS = {};
