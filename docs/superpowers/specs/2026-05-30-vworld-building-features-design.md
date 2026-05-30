# VWorld 건물 기능 묶음 — 설계서

- **날짜**: 2026-05-30
- **상태**: 승인됨 (구현 대기)
- **범위**: 프론트엔드 `frontend/public/legacy-map/` 중심 + 기존 VWorld 프록시 재사용. 백엔드 무변경(선택 항목 제외).

---

## 1. 배경 / 목표

VWorld 디지털트윈 화면의 신규 기능들을 TwinLand 3D 지도에 이식한다. 단, **"VWorld 플랫폼 기능 ≠ 외부 API 제공"** 이라 실현가능성으로 선별했다(VWorld 3D Open API는 2019년 폐쇄 → 실사 LoD4 타일 직접 이식 불가). 이번 라운드는 **외부 API로 가능 + TwinLand(국내 필지) 미션에 맞는** 4기능으로 한정한다.

**제외(이번 라운드 아님):** 정밀도로지도(자율주행용·미션 밖·무거움), 국외 위성영상(해외·외부 API 불확실).

## 2. 실현가능성 (라이브 프록시 확정)

`/api/vworld/data` (기존 프록시, 키·도메인 서버 강제) 로 `GetFeature` 확인 완료:

- **`LT_C_SPBD`** (GIS건물통합정보): `status=OK`, `geometry=MultiPolygon`(건물 외곽선), 속성:
  - `buld_nm`(건물명), `gro_flo_co`(지상층수), `rd_nm`·`sido`·`sigungu`·`gu`·`buld_no`(주소), `bd_mgt_sn`(건물관리번호), `bul_eng_nm`(영문명)
- **`LT_C_UQ111`**(용도지역) 등 오버레이 패턴 정상 (`uname` 등)
- 기존 `LP_PA_CBND_BUBUN`(연속지적도)·`/api/vworld/ned/getLandCharacteristics`(토지특성) 이미 사용 중 → 재사용.

`LT_C_SPBD`는 **건물명·지상층수·주소·관리번호**만 제공(구조·면적·사용승인일 없음). 표제부 풀버전은 건축HUB(data.go.kr) 키가 필요하므로 **이번엔 채택 안 함** — 대신 기존 NED 토지특성으로 보강(결정사항 §6).

## 3. 기능별 설계

### 3.1 GIS 3D 건물 (`vworld-buildings.js`)
- "3D 전용" 패널에 토글 **`#toggle-vworld-3d`** ("VWorld 건물(입체)") 추가.
- ON + 카메라 고도 < 임계(기본 2000m)일 때: 현재 화면 bbox 로 `LT_C_SPBD` GetFeature(`geomFilter=BOX(...)`, `geometry=true`, `attribute=true`, `size=1000`, `crs=EPSG:4326`).
- 각 MultiPolygon → Cesium `Entity` polygon, `extrudedHeight = (parseInt(gro_flo_co)||1) * 3.3`, `material`=반투명 단색(스타일 패널 값 재사용 가능), `height=0`(지면 기준).
- 카메라 이동 → 디바운스(400ms) 재조회. bbox 캐시(기존 `cacheGet/cacheSet` 패턴 재사용). 토글 OFF → 엔티티 제거.
- 성능: 고도 임계 초과 시 로드 보류 + 안내, `size` 상한, bbox 캐시로 중복 방지.

### 3.2 건축물정보 팝업 (`vworld-buildings.js` + `map-popup.js`)
- **신규 클릭 디스패처** `installClickHandler()` — `ScreenSpaceEventHandler`(LEFT_CLICK). 현재 cesium-app.js 에 picking 핸들러 없음 → 신설. 모드(일반 조회 / 가상건물 그리기)에 따라 분기(§3.3 충돌 방지).
- 일반 모드 클릭 시: `viewer.scene.pickPosition`(또는 `camera.pickEllipsoid`) → `lng/lat`. 병렬 질의:
  1. `LT_C_SPBD` `POINT(lng lat)` → 건물(건물명·지상층수·주소·`bd_mgt_sn`)
  2. `LP_PA_CBND_BUBUN` `POINT(lng lat)` → 필지(`pnu`·지번·지목) — app.js 기존 질의 로직 재사용
  3. (2의 pnu 로) `getLandCharacteristics(pnu)` → 토지특성(공시지가·토지이용상황 등). **app.js 의 `fetchLandCharacteristics`/필지 POINT 질의가 `window` 에 노출돼 있으면 재사용, 아니면 동일 fetch(약 10줄)를 새 모듈에 복제** (app.js 내부 스코프 의존 금지).
- HTML 팝업 패널(`map-popup.js`, 재사용 컴포넌트): 헤더=건물명/주소, 본문=지상층수·건물관리번호·지목·공시지가·토지이용상황. 닫기 버튼. 건물 미존재(나대지)면 필지+토지특성만.
- 클릭된 3D 건물 엔티티가 있으면 하이라이트(선택 색).

### 3.3 가상건물 (`virtual-building.js`)
- 좌측 패널에 **신규 "가상건물" 그룹** (`#group-virtual-building`): 입력 `층고(m)`·`층수`·`투명도`·`건물명`, 버튼 `건물그리기`/`저장`/`전체삭제`.
- `건물그리기` → 그리기 모드 진입(클릭 디스패처가 일반 조회 대신 정점 추가). 지도 클릭으로 폴리곤 정점 누적, 더블클릭/Enter 로 완료 → `Entity` polygon `extrudedHeight = 층수 × 층고`, 반투명, 라벨=건물명.
- 저장: `localStorage`(`twinland_virtual_buildings`) 직렬화(정점+속성). 로드시 복원. (VWorld 는 로그인 저장이나, 우리는 로컬.)
- 그리기 모드 중에는 건축물정보 팝업 비활성(모드 플래그).

### 3.4 단지용도지역 오버레이 (`zoning-overlay.js`)
- GIS 오버레이 패널에 토글 추가. bbox 로 단지용도지역 레이어 GetFeature → 폴리곤 색칠(용도분류별) + 클릭 팝업(용도분류·단지명).
- **리스크:** 정확한 VWorld Data API 레이어 코드 미확정(신규 데이터, 2026.4). 구현 1단계에서 **라이브 프록시로 코드 확정**(후보 probe). 코드 없거나 미제공이면 사용자에 보고 후 보류(다른 3기능엔 영향 없음).
- 패턴은 `LT_C_UQ111` 와 동일.

## 4. 공유 인프라 / 파일 구조

`cesium-app.js`가 이미 큼 → 신규 기능은 **모듈 분리**(기존 app.js/parcels.js/landinfo.js/editor.js 다중 `<script>` 패턴 동일, `window`/전역 공유):

| 파일 | 책임 |
|---|---|
| `vworld-buildings.js` | LT_C_SPBD fetch, 3D 압출 토글, 건물 클릭 조회 |
| `map-popup.js` | 재사용 HTML 팝업 패널(열기/닫기/내용 주입) |
| `virtual-building.js` | 가상건물 그리기·압출·localStorage |
| `zoning-overlay.js` | 단지용도지역 오버레이 |
| (수정) `cesium-app.js` | 클릭 디스패처 설치 + 모듈 초기화 훅 + 공개 API 노출 |
| (수정) `index.html` | 토글/패널 마크업 + 새 `<script>` 로드 |

클릭 디스패처는 **단일 핸들러**에서 현재 모드(`idle`/`drawing`)로 분기 — 핸들러 중복/충돌 방지.

## 5. 빌드 순서 (구현 단계)

1. **Phase 1 — 건물 3D + 팝업**(①②): LT_C_SPBD 토대 공유. 클릭 디스패처·팝업 컴포넌트 신설.
2. **Phase 2 — 가상건물**(③): 클릭 디스패처에 그리기 모드 추가.
3. **Phase 3 — 단지용도지역**(④): 코드 확정 후 오버레이.

각 Phase 는 독립적으로 동작·검증 가능(별도 plan 으로 분리 가능).

## 6. 의사결정 기록

- **팝업 상세도 = 기본 + NED 토지특성 보강**(사용자 선택). 건축HUB(data.go.kr) 키 미도입 → 새 시크릿/프록시 없음. 표제부(구조·면적·사용승인일)는 향후 키 확보 시 fast-follow.
- **3D = 압출(LoD1)**: VWorld 실사 LoD4 외부 불가. 실사 외관은 기존 Google 3D, 데이터 3D는 LT_C_SPBD 압출(정확 높이·선택·정보 연동). 비실사.
- **단지용도지역 코드 미확정**: 구현 1단계 라이브 확정, 불가 시 보류.
- **모듈 분리**: cesium-app.js 비대화 방지.

## 7. 검증 계획

legacy-map 은 테스트 하니스 없음 → **수동 스모크 + node --check + 라이브 프록시 probe**:
- `node --check` 신규 JS 전부.
- 라이브 probe: 단지용도지역 코드 확정, LT_C_SPBD bbox 응답 건수.
- 수동: 3D 건물 토글 on/off·줌, 건물 클릭→팝업(건물명·층수·공시지가), 가상건물 그리기·저장·복원, 단지 오버레이·클릭.
- 콘솔 미처리 예외 없음.

## 8. 리스크

- **단지용도지역 레이어 코드**(신규 데이터) — 미제공 가능. → Phase 3 분리, 사전 probe.
- **3D 건물 밀도/성능** — bbox+고도임계+캐시로 완화. 대도시 과다 로드 주의.
- **pickPosition 정확도** — 지형/3D 타일 위 클릭 좌표. `pickPosition` 실패 시 `pickEllipsoid` 폴백.
- **클릭 핸들러 충돌** — 기존 2D(app.js)와 3D(cesium-app.js) 분리되어 있어 3D 뷰 한정 신설.
