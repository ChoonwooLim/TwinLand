# DEM (수치표고모델) 인제스트 — 경사도분석용

경사도분석은 **NGII 5m 수치표고모델(DEM)** 을 입력으로 쓴다. 산림 SHP 처럼
**수동 수급 + 파일시스템 배치** 방식(코드는 미리 완성, DEM 투입 시 즉시 동작).

관련: [경사도분석 설계서](superpowers/specs/2026-05-30-slope-analysis-design.md),
[구현 계획](superpowers/plans/2026-05-30-slope-analysis.md).

---

## 1. 어디서 받나 — 국토정보플랫폼 (NGII)

1. **map.ngii.go.kr** (국토정보플랫폼) 접속 → 로그인(무료 가입 필요).
2. **[공간정보 다운로드]** (또는 [자료실 > 다운로드]) → **수치표고모델(DEM)** → **5m 격자**.
   - 메뉴 명칭은 개편될 수 있음 — "수치표고", "DEM", "5m" 키워드로 탐색.
3. **대상 영역 = 양평·여주** (PROJECT_BBOX `127.50,37.30,127.85,37.60`).
   지도에서 영역 선택 또는 해당 **도엽번호**(1:5,000 도엽) 검색해 담기.
4. 다운로드.

## 2. 포맷 / 좌표계 (받은 뒤 확인)

- 포맷: 보통 `.img`(ERDAS) 또는 `.tif`. rasterio 가 GDAL 경유로 둘 다 읽음.
- 좌표계: NGII DEM 은 보통 **EPSG:5186**(Korea 2000 / 중부원점) 또는 **EPSG:5179**(UTM-K).
  → 코드가 `dataset.crs` 를 **동적으로** 읽어 재투영하므로 어느 쪽이든 OK.
- 확인 명령(선택): `python -c "import rasterio; d=rasterio.open('파일'); print(d.crs, d.res, d.bounds)"`

## 3. 어디에 두나

```
backend/data/dem/        ← 여기에 받은 DEM 파일(들) 배치
  여주_북내면_5m.img      (예시)
  양평_xxx_5m.img
```

- 환경변수 **`DEM_DIR`** 로 경로 지정(기본 `backend/data/dem`). `.env` 에 추가:
  ```
  DEM_DIR=backend/data/dem
  ```
- 여러 도엽이면 그대로 둬도 됨(코드가 디렉토리 내 파일에서 필지 포함 타일 탐색).
  필요 시 `gdal_merge.py -o merged.tif *.img` 로 1개 병합(선택, 더 간단).

## 4. 투입 후 동작 확인

1. 백엔드 재기동.
2. `GET /api/terrain/slope?pnu=<상교리 샘플 PNU>` → `avg_deg`/`max_deg`/`classes` 반환되면 성공.
3. 프론트에서 필지 클릭 → 경사 정보 팝업 표시.
4. DEM 미투입 상태면 엔드포인트가 `503 {"detail":"DEM not configured"}` 반환(정상 — 파일만 넣으면 됨).

## 5. 라이선스

NGII 수치표고모델은 출처표시 조건 공공데이터. 보고서/화면에 **출처: 국토지리정보원** 표기.
