// JooJoo Land - 지번 데이터 (34필지)
// 소재지: 경기도 양평군 양동면 금왕리 / 고송리
// 총 면적: 517,180㎡ (약 156,442평)

const PARCELS_STORAGE_KEY = 'joojoo_custom_parcels';
const PREFIX_STORAGE_KEY = 'joojoo_address_prefix';

window.DEFAULT_ADDRESS_PREFIX = '경기도 양평군 양동면';
window.DEFAULT_PARCELS = [
  { no:  1, location: '금왕리', lot: '469',     category: '전',   area_m2:    585, area_pyeong:    177, owner: '이재호',   memo: '원주' },
  { no:  2, location: '금왕리', lot: '469-1',   category: '임',   area_m2:    509, area_pyeong:    154, owner: '이세용',   memo: '서울' },
  { no:  3, location: '금왕리', lot: '469-2',   category: '답',   area_m2:   1620, area_pyeong:    490, owner: '이세용',   memo: '서울' },
  { no:  4, location: '금왕리', lot: '470',     category: '전',   area_m2:   1124, area_pyeong:    340, owner: '이세용',   memo: '서울' },
  { no:  5, location: '금왕리', lot: '471',     category: '답',   area_m2:   1514, area_pyeong:    458, owner: '이세용',   memo: '서울' },
  { no:  6, location: '금왕리', lot: '472',     category: '전',   area_m2:    932, area_pyeong:    282, owner: '이세용',   memo: '서울' },
  { no:  7, location: '금왕리', lot: '473',     category: '답',   area_m2:    423, area_pyeong:    128, owner: '이정용',   memo: '원주' },
  { no:  8, location: '금왕리', lot: '474',     category: '임',   area_m2:    169, area_pyeong:     51, owner: '덕수이씨', memo: '고당파' },
  { no:  9, location: '금왕리', lot: '475-1',   category: '전',   area_m2:    678, area_pyeong:    205, owner: '이세용',   memo: '서울' },
  { no: 10, location: '금왕리', lot: '475-2',   category: '전',   area_m2:    936, area_pyeong:    283, owner: '이정용',   memo: '원주' },
  { no: 11, location: '금왕리', lot: '476-1',   category: '임',   area_m2:   2595, area_pyeong:    785, owner: '덕수이씨', memo: '고당파' },
  { no: 12, location: '금왕리', lot: '476-2',   category: '전',   area_m2:    192, area_pyeong:     58, owner: '이세용',   memo: '서울' },
  { no: 13, location: '금왕리', lot: '476-3',   category: '전',   area_m2:    879, area_pyeong:    266, owner: '이정용',   memo: '원주' },
  { no: 14, location: '금왕리', lot: '479-2',   category: '대',   area_m2:   1091, area_pyeong:    330, owner: '덕수이씨', memo: '고당파' },
  { no: 15, location: '금왕리', lot: '480',     category: '대',   area_m2:    526, area_pyeong:    159, owner: '덕수이씨', memo: '고당파' },
  { no: 16, location: '금왕리', lot: '481',     category: '대',   area_m2:    367, area_pyeong:    111, owner: '덕수이씨', memo: '고당파' },
  { no: 17, location: '금왕리', lot: '482',     category: '답',   area_m2:   1722, area_pyeong:    521, owner: '덕수이씨', memo: '고당파' },
  { no: 18, location: '금왕리', lot: '483',     category: '임',   area_m2:    724, area_pyeong:    219, owner: '덕수이씨', memo: '고당파' },
  { no: 19, location: '금왕리', lot: '484-1',   category: '답',   area_m2:  13405, area_pyeong:   4055, owner: '덕수이씨', memo: '고당파' },
  { no: 20, location: '금왕리', lot: '485',     category: '전',   area_m2:   1517, area_pyeong:    459, owner: '덕수이씨', memo: '고당파' },
  { no: 21, location: '금왕리', lot: '486-1',   category: '임',   area_m2:   4294, area_pyeong:   1299, owner: '덕수이씨', memo: '고당파' },
  { no: 22, location: '금왕리', lot: '486-2',   category: '전',   area_m2:    159, area_pyeong:     48, owner: '이세용',   memo: '서울' },
  { no: 23, location: '금왕리', lot: '487',     category: '답',   area_m2:   1332, area_pyeong:    403, owner: '덕수이씨', memo: '고당파' },
  { no: 24, location: '금왕리', lot: '488',     category: '임',   area_m2:    558, area_pyeong:    168, owner: '덕수이씨', memo: '고당파' },
  { no: 25, location: '금왕리', lot: '488-2',   category: '임',   area_m2:   2497, area_pyeong:    755, owner: '덕수이씨', memo: '고당파' },
  { no: 26, location: '금왕리', lot: '488-4',   category: '임',   area_m2:    545, area_pyeong:    164, owner: '덕수이씨', memo: '고당파' },
  { no: 27, location: '금왕리', lot: '490',     category: '전',   area_m2:    201, area_pyeong:     60, owner: '이세용',   memo: '서울' },
  { no: 28, location: '금왕리', lot: '492',     category: '답',   area_m2:    258, area_pyeong:     78, owner: '이세용',   memo: '서울' },
  { no: 29, location: '금왕리', lot: '493-1',   category: '전',   area_m2:    549, area_pyeong:    166, owner: '이봉렬',   memo: '삼산리' },
  { no: 30, location: '금왕리', lot: '496',     category: '임',   area_m2:    225, area_pyeong:     68, owner: '덕수이씨', memo: '고당파' },
  { no: 31, location: '금왕리', lot: '498',     category: '전',   area_m2:    616, area_pyeong:    186, owner: '이세용',   memo: '서울' },
  { no: 32, location: '금왕리', lot: '산205',   category: '임야', area_m2: 471672, area_pyeong: 142680, owner: '덕수이씨', memo: '고당파' },
  { no: 33, location: '금왕리', lot: '산205-3', category: '임야', area_m2:   2766, area_pyeong:    836, owner: '덕수이씨', memo: '고당파' },
  { no: 34, location: '고송리', lot: '산86',    category: '임야', area_m2:   3273, area_pyeong:    990, owner: '덕수이씨', memo: '고당파' },
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
  '임야': '#e91e63',  // 임야    - 핫핑크/마젠타 (산205 잘 보이도록)
  '대':   '#ffeb3b',  // 대(垈) - 노랑
};

// 소유자별 색상 (필터용)
window.OWNER_COLORS = {
  '덕수이씨': '#d32f2f',
  '이세용':   '#1976d2',
  '이정용':   '#388e3c',
  '이재호':   '#f57c00',
  '이봉렬':   '#7b1fa2',
};
