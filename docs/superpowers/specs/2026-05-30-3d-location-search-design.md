# 3D 위치 검색 기능 이식 — 설계서

- **날짜**: 2026-05-30
- **상태**: 승인됨 (구현 대기)
- **유형**: 기능 이식 (JooJooLand → TwinLand)
- **범위**: 프론트엔드 `frontend/public/legacy-map/`만. 백엔드 변경 없음.

---

## 1. 배경 / 문제

`/map` 페이지는 React [`Map.jsx`](../../../frontend/src/pages/Map.jsx)가 정적 Cesium 앱
`frontend/public/legacy-map/index.html`을 iframe으로 감싼 구조다.

JooJooLand(부모 저장소, `C:\WORK\JooJooLand`)의 동일 legacy-map에는 3D 패널("3D 전용")에
**위치 검색 기능**이 추가되어 운영 중이다(스크린샷 기준):

- 주소·도시명 입력 → 이동
- 위도·경도 직접 입력 → 이동

TwinLand는 JooJooLand를 포크한 뒤 이 기능이 **절반만 이식된 상태**다:

- `cesium-app.js`의 `wireControls`(현재 494–509행)는 `#fly-address`/`#fly-btn`을 참조하지만,
- 해당 HTML 입력 요소가 `index.html`에 **없어** 기능이 휴면 상태다.
- 위/경도 셀 배선, 그리고 지오코딩 함수 다수가 **누락**되어 있다.
- 현재 TwinLand의 `flyToAddress`(453–479행)는 VWorld 단일 tier로만 동작하는 **구버전**이다.

## 2. 목표

JooJooLand의 "새로운 3D 위치 검색 기능"을 TwinLand에 **그대로(전 세계 범위) 이식**해
패리티를 맞춘다.

## 3. 범위

### 포함 (In scope)
- 주소·도시명 지오코딩 검색 (4단계 폴백)
- 위도·경도 직접 입력 이동
- 위 두 기능의 HTML UI + 이벤트 배선

### 제외 (Out of scope / YAGNI)
- 백엔드 변경 (불필요 — 프록시·키 주입 이미 존재)
- 검색 자동완성/히스토리, 마커 표시 등 신규 UX
- 무관한 리팩토링
- legacy-map의 i18n(react-i18next) 전환

## 4. 현재 상태 vs 목표

| 항목 | TwinLand 현재 | 목표 (JooJooLand) |
|---|---|---|
| `flyToAddress` | VWorld 단일 tier, 실패 시 alert | 4단계 폴백 (좌표/VWorld/Ion/OSM) |
| 위/경도 직접 입력 | 없음 | `#fly-lat`/`#fly-lng` + 검증 후 이동 |
| `parseLatLng` | 없음 | 있음 |
| `flyToLngLat` | 없음 (inline) | 공용 헬퍼 |
| `flyToGeocodeDestination` | 없음 | 있음 (Rectangle/Cartesian3 대응) |
| `ionGeocode` / `osmGeocode` | 없음 | 있음 |
| 검색 HTML | 없음 | `#group-3d-only` 내 입력 UI |

## 5. 설계 상세

### 5.1 변경 파일

**(1) `frontend/public/legacy-map/index.html`**
`#group-3d-only`의 두 체크박스(`#toggle-google-3d`, `#toggle-osm-buildings`) **아래**에
JooJooLand `index.html`(261–271행)의 마크업을 그대로 추가:

- 주소 입력 `#fly-address` (placeholder: `주소·도시명 → 이동 (예: 서울 강남구 / Tokyo)`) + `#fly-btn`("이동")
- 위도 `#fly-lat` / 경도 `#fly-lng` (`inputmode="decimal"`) + `#fly-latlng-btn`("이동")
- 인라인 스타일·레이블 모두 원본과 동일.

**(2) `frontend/public/legacy-map/cesium-app.js`**

- **추가** (현재 부재): `parseLatLng`, `flyToLngLat`, `flyToGeocodeDestination`
  (JooJooLand 453–483행 그대로)
- **추가**: `ionGeocode`(`window.CESIUM_ION_TOKEN` 가드), `osmGeocode`(OSM Nominatim)
  (JooJooLand 485–512행 그대로)
- **교체**: TwinLand `flyToAddress`(453–479행) → JooJooLand 4단계 버전(514–557행)
- **확장**: `wireControls`에 위/경도 셀 배선(`goCoord`) 추가
  (JooJooLand 589–607행). 주소 입력·버튼 배선은 TwinLand에 이미 존재하므로 보존.
- `flyToAddress`는 기존처럼 공개 API 객체(576행 부근)에 유지.

### 5.2 데이터 흐름 — `flyToAddress(query)`

```
입력(query) ─┬─ parseLatLng 적중("37.56, 126.97")  → flyToLngLat
             ├─ VWorld /api/vworld/address getcoord (road→parcel) → flyToLngLat
             ├─ Cesium Ion 지오코더 (토큰 존재 시)  → flyToGeocodeDestination
             ├─ OSM Nominatim                        → flyToLngLat
             └─ 모두 실패                            → alert("위치를 찾지 못했습니다…")
```

위/경도 셀(`goCoord`): 범위 검증(위도 -90~90, 경도 -180~180) 통과 시 `flyToLngLat`,
실패 시 `alert`.

### 5.3 에러 처리

- 각 tier `try/catch` → `console.warn` 후 다음 tier로 폴백.
- Cesium Ion: 토큰 없으면 `ionGeocode`가 `null` 반환 → 조용히 OSM으로.
- 최종 미발견 시에만 사용자에게 `alert`.
- 잘못된 위/경도 입력 → `alert`.

### 5.4 인프라 (이미 존재, 변경 없음)

- VWorld 프록시: [`backend/app/routers/vworld.py`](../../../backend/app/routers/vworld.py) `/api/vworld/address`
  (`_prepare_vworld_params`가 키·도메인을 서버에서 강제) → **CLAUDE.md §2.4 준수**.
- 키 주입: `vworld.py`의 `/api/vworld/config.js`가
  `window.VWORLD_KEY`·`window.CESIUM_ION_TOKEN` 주입.
- `cesium_ion_token`은 [`backend/app/core/config.py`](../../../backend/app/core/config.py)에 설정(미설정 시 Ion tier 자동 skip).

## 6. 의사결정 기록

- **지오코딩 범위 = 전 세계**: 사용자 승인. VWorld→Ion→OSM 폴백 유지. 해외 검색 시
  브라우저가 `nominatim.openstreetmap.org`를 직접 호출(외부 의존성 추가)함을 수용.
- **i18n 예외**: legacy-map은 순수 vanilla-JS 정적 앱으로 하드코딩 한국어 사용이 기존 관례
  (`Google 실사 3D 건물` 등). 이식분도 동일하게 하드코딩 유지. React i18n 규칙(CLAUDE.md §3.1)은
  legacy-map에 비적용.
- **구현 방식 = 검증된 코드 그대로 이식**: 동일 구조·동일 인프라이므로 원본 함수를 그대로 가져오는
  것이 위험 최소.

## 7. 검증 계획

legacy-map은 테스트 하니스가 없으므로 **수동 스모크 테스트**:

1. `npm run build` 정상 통과.
2. 앱 구동 후 `/map` iframe에서:
   - "서울 강남구" → VWorld tier 이동 확인
   - "Tokyo" → Ion 또는 OSM tier 이동 확인
   - "37.5665, 126.978" → parseLatLng 이동 확인
   - 위도/경도 셀 입력 → 이동 확인
   - 빈/오타 입력 → 적절한 alert 확인
3. 브라우저 콘솔에 미처리 에러 없음 확인.

## 8. 롤백

프론트 정적 파일 2개 변경뿐이므로 git revert로 즉시 원복 가능.
