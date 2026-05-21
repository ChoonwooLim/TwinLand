# 산림청 SHP 자체 적재 — 멀티 프로젝트 운영 가이드

## Orbitron 실제 배포 레시피 (양평 예시)

1. 원본 데이터는 `\\twinverse\forest-archive` (Windows 에서 `Z:`, 호스트에선 `/srv/TwinverseFolder/forest-archive`) 에 폴더명별 정리:
   - `41830_임상도_5000`, `41830_산림입지도_5000/25000`, `41830_산림기능구분도`,
     `41830_경제림육성단지_국유림/사유림`, `41830_임도망도`, `41830_산사태위험지도_1`,
     `{11|26|27|28|29|30|31|41|43|44|50}_등산로_포인트_속성정보`
2. Orbitron 호스트에서 프로젝트 볼륨으로 복사 (심볼릭 링크는 컨테이너에서 해석 불가):
   ```bash
   ssh stevenlim@192.168.219.101
   VOL=/home/stevenlim/WORK/orbitron/deployments/joojooland/_volumes/data
   cp -a /srv/TwinverseFolder/forest-archive "$VOL/forest"
   ```
3. Orbitron 프로젝트 환경변수 추가 (관리 UI):
   ```
   FOREST_SHP_DIR=/app/data/forest
   LANDSLIDE_RASTER_PATH=/app/data/forest/41830_산사태위험지도_1/41830.tif
   PROJECT_BBOX=127.50,37.30,127.85,37.60
   PROJECT_NAME=JooJooLand
   ```
4. 컨테이너 안에서 레이어별 적재:
   ```bash
   CID=$(ssh stevenlim@192.168.219.101 "docker ps -q -f name=orbitron-joojooland-" | head -1)

   for pair in \
     "imsang 41830_임상도_5000" \
     "soil 41830_산림입지도_5000" \
     "productivity 41830_산림입지도_25000" \
     "forest_function 41830_산림기능구분도" \
     "state_forest 41830_경제림육성단지_국유림" \
     "private_forest 41830_경제림육성단지_사유림" \
     "forest_road 41830_임도망도"; do
     set -- $pair
     ssh stevenlim@192.168.219.101 "docker exec $CID python -m scripts.ingest_forest_shp \
       --layer $1 --file /app/data/forest/$2/41830.shp \
       --bbox 127.50,37.30,127.85,37.60 --truncate"
   done

   # 등산로 (경기도만 BBOX 에 걸림, 나머지 10개 시·도는 0건)
   for code in 41; do
     ssh stevenlim@192.168.219.101 "docker exec $CID python -m scripts.ingest_forest_shp \
       --layer mountain_poi --file /app/data/forest/${code}_등산로_포인트_속성정보/${code}.shp \
       --bbox 127.50,37.30,127.85,37.60 --truncate"
   done
   ```
5. 확인:
   ```bash
   curl -s https://joojooland.twinverse.org/api/forest/status | python -m json.tool
   # loaded_layers 에 imsang/soil/productivity/forest_function/state_forest/
   # private_forest/forest_road/mountain_poi 값이 0 초과로 나와야 OK.
   # landslide_raster_ready: true 도 확인.
   ```


## FGIS 배포 단위

FGIS 는 같은 레이어라도 배포 단위 여러 개가 병존:

| 레이어 | 배포 단위 | 파일명 예 | 권장 선택 |
|--------|----------|----------|----------|
| 🥾 등산로 포인트 `mountain_poi` | **시·도** | `41.zip` | 시·도 |
| 🌲 임상도 `imsang` | **시·군·구** (법정동 5자리) / 도엽 | `41830.zip` (양평군) 또는 `37711009.zip` | **시·군·구** (한 번에 완주) |
| ⛰️ 산지구분도 `sanji` | **시·군·구** / 도엽 | 동일 | **시·군·구** |
| ⚠️ 산사태위험 `landslide` | **시·군·구** / 도엽 | 동일 | **시·군·구** |
| 🌱 산림입지토양도 `soil` | **시·군·구** / 도엽 | 동일 | **시·군·구** |

한 시·군·구 ZIP 에 해당 군 전체 도엽이 포함돼 있어 **시·군·구 단위로 받는 게 훨씬 편함**. 도엽 단위는 더 작은 영역만 필요할 때 사용.

## 레이어 종류 요약 — 어떤 데이터를 어떤 레이어로?

| FGIS 다운로드 형태 | 지오메트리 | 레이어 키 | 분석 방식 |
|-------------------|-----------|----------|-----------|
| 임상도 도엽 ZIP (FRTP_S) | Polygon | `imsang` | 파셀과 교집합 면적 (수종·경급·영급·수관밀도) |
| 산지구분도 도엽 ZIP (MT_CBND) | Polygon | `sanji` | 교집합 → 보전/준보전/임업용/공익용 면적 |
| 산사태위험등급도 도엽 ZIP | Polygon | `landslide` | 교집합 → 등급별 면적 |
| 산림입지토양도 도엽 ZIP | Polygon | `soil` | 교집합 → 토양종류·심도 |
| 등산로 시도별 ZIP (DATA001) | **Point** | `mountain_poi` | 주변 반경 검색 (거리·카테고리) |

## 프로젝트를 덮는 도엽 찾기

1. FGIS https://map.forest.go.kr/ 접속 → **"지도 서비스"** 탭
2. 좌측 레이어 목록에서 **"도엽색인도 (1:5,000)"** 켜기 → 지도 위 격자 노출
3. 검색창에 프로젝트 주소 (예: `경기도 양평군 양동면 금왕리 469`)
4. 34 필지 덮는 **모든 도엽 번호 클릭해서 메모** (보통 3~6 장)
5. **"자료 다운로드"** → 임상도/산지구분도/산사태위험 각 레이어별로 해당 도엽 모두 다운로드

한 프로젝트당 **(도엽 수 × 레이어 수)** 개의 ZIP 을 받게 됨.
예: 6 도엽 × 3 레이어 = 18 ZIP. 전부 받아서 레이어별로 디렉토리에 정리.

## 도엽 단위 ZIP 일괄 적재

```bash
# 레이어별로 디렉토리 분리해두기
/data/forest/sheets/
  imsang/        ← 임상도 도엽 ZIP 3~6 개
    37706087.zip
    37706088.zip ...
  sanji/         ← 산지구분도 도엽 ZIP
    37706087.zip ...
  landslide/     ← 산사태위험 도엽 ZIP
    37706087.zip ...

# 각 레이어 적재 (도엽별로 나눠 풀고 DB 에 모음)
docker exec orbitron-joojooland-XXX python -m backend.scripts.ingest_forest_sheets \
  --layer imsang --source-dir /data/forest/sheets/imsang --truncate

docker exec orbitron-joojooland-XXX python -m backend.scripts.ingest_forest_sheets \
  --layer sanji --source-dir /data/forest/sheets/sanji --truncate

docker exec orbitron-joojooland-XXX python -m backend.scripts.ingest_forest_sheets \
  --layer landslide --source-dir /data/forest/sheets/landslide --truncate
```

**레이어 자동 판정**: 디렉토리에 섞여있을 때 `--layer auto` 로 스키마 보고 자동 분류:
```bash
python -m backend.scripts.ingest_forest_sheets --layer auto --source-dir /data/forest/sheets/all/ --truncate
```

## 지금 받은 파일을 어디에 넣는가

## 지금 받은 파일을 어디에 넣는가

받으신 `11.zip ~ 50.zip` 은 전부 **등산로 포인트** 데이터.

```
/data/forest/mountain_poi/   ← 시도별 등산로 ZIP
  11.zip (서울)  26.zip (부산) ... 41.zip (경기) ...
  50.zip (제주)
```

`docker exec ... python -m backend.scripts.ingest_mountain_poi --source-dir /data/forest/mountain_poi --truncate`
로 한 번에 적재. 내부에서 각 ZIP 을 임시 폴더에 풀어 SHP 읽음.

임상도·산지구분도·산사태위험등급도 폴리곤 SHP 는 **별도**:

```
/data/forest/nationwide/
  imsang.shp, imsang.shx, imsang.dbf, imsang.prj
  sanji.shp, ...
  landslide.shp, ...
```

`ingest_forest_all.py` 로 일괄.


## 아키텍처 한 장 요약

```
Orbitron 호스트 (192.168.219.101)
├── /data/forest/nationwide/        ← 전국 SHP 원본 (수 GB). 여러 프로젝트 공유
│     imsang.shp/.shx/.dbf/.prj
│     sanji.shp/.shx/.dbf/.prj
│     landslide.shp/.shx/.dbf/.prj
│
└── 컨테이너들
      ├── joojooland  (DB 에 양평 BBOX 범위만 주입, 수 MB)
      ├── pyeongchang (DB 에 평창 BBOX 범위만 주입)
      └── ...
```

- **SHP 원본 = 파일시스템** (호스트 디렉토리 한 곳)
- **프로젝트 DB = 해당 BBOX 만큼만 WKB 로** 주입 (DB 에 원본 파일 저장 안 함)
- 각 컨테이너는 `/data/forest:ro` 바인드 마운트로 같은 원본을 공유
- 갱신 시 원본 1 곳만 교체 → 프로젝트별 재적재 명령 1 회씩

## 1 회 세팅 (최초 1 번)

### 1-1. FGIS 가입 + 전국 자료 신청
- https://map.forest.go.kr/ 회원가입 후 로그인
- **자료 다운로드** 메뉴 → 다음 3~4 종 "전국" 으로 신청:
  1. **임상도** (FRTP)
  2. **산지구분도** (MT_CBND 또는 산지구분)
  3. **산사태위험등급도**
  4. *(선택)* **산림입지토양도**
- 신청 사유: "투자유치용 시각화, 비영리". 승인 **1~3 영업일**
- 이메일로 온 링크에서 ZIP 다운로드 — 파일이 크니(최대 수 GB) 넉넉한 디스크/네트워크에서

### 1-2. Orbitron 호스트에 원본 배치
```bash
# 로컬 PC → Orbitron 호스트로 업로드
scp imsang_kr.zip sanji_kr.zip landslide_kr.zip stevenlim@192.168.219.101:~/shp_upload/

# Orbitron 호스트 접속
ssh stevenlim@192.168.219.101

# 디렉토리 생성 + 압축 해제
sudo mkdir -p /data/forest/nationwide
sudo chown -R $USER /data/forest
cd /data/forest/nationwide
unzip ~/shp_upload/imsang_kr.zip
unzip ~/shp_upload/sanji_kr.zip
unzip ~/shp_upload/landslide_kr.zip

# 확인
ls -la
# imsang.shp  imsang.shx  imsang.dbf  imsang.prj
# sanji.shp   sanji.shx   sanji.dbf   sanji.prj
# landslide.shp ...
```

> **파일명이 다를 때**: FGIS 가 내려주는 실제 파일명이 `FRTP_S.shp`, `MT_CBND.shp`
> 등일 수 있음. `ingest_forest_all.py` 의 `LAYER_FILENAME_CANDIDATES` 에 그대로
> 열거돼 있어 자동 매칭. 매칭 안 되면 심볼릭 링크로 연결하거나 후보에 추가.

### 1-3. 컨테이너에 원본 바인드 마운트 (프로젝트별 1 회)
Orbitron 관리 UI 에서 해당 프로젝트 컨테이너 설정에 볼륨 추가:
- Source: `/data/forest/nationwide`
- Target: `/data/forest`
- Mode: `read-only`

또는 Orbitron.yaml 에 선언 (플랫폼이 지원하는 경우):
```yaml
volumes:
  - /data/forest/nationwide:/data/forest:ro
```

### 1-4. 속성 컬럼 확인 (레이어 매핑 튜닝)
```bash
# 호스트에서
python3 -c "import pyogrio; print(pyogrio.read_info('/data/forest/nationwide/imsang.shp')['fields'])"
```
실제 컬럼명이 `backend/app/services/forest_gis.py` 의 `classify_sanji / imsang / landslide` 의
`_pick(...)` 후보와 다르면 매핑 수정 후 재배포.

## 프로젝트 생성/갱신 때마다

### .env 설정
`backend/.env` 또는 Orbitron 프로젝트 환경변수:
```env
FOREST_SHP_DIR=/data/forest           # 컨테이너 내부 마운트 경로
PROJECT_BBOX=127.50,37.30,127.85,37.60  # 프로젝트 영역 (lngMin,latMin,lngMax,latMax)
PROJECT_NAME=JooJooLand
```

### 적재 (한 명령)
```bash
# Orbitron 컨테이너 안
docker exec orbitron-joojooland-XXXX python -m backend.scripts.ingest_forest_all --truncate

# 출력 예
# [config] project=JooJooLand bbox=(127.5, 37.3, 127.85, 37.6) shp_dir=/data/forest
# [config] layers=['imsang', 'sanji', 'landslide'] truncate=True
# === imsang ← imsang.shp ===
# [read] 2341 features in bbox
# [ingest] +500 (total 500)
# ...
# === 적재 요약 ===
#   imsang     ok          inserted=2341 message=from imsang.shp
#   sanji      ok          inserted=587  message=from sanji.shp
#   landslide  ok          inserted=1120 message=from landslide.shp
```

### 확인
```bash
curl https://joojooland.twinverse.org/api/forest/status
# { "loaded_layers": { "imsang": 2341, "sanji": 587, "landslide": 1120 }, "ready": true }
```

프론트에서 `📊 토지정보` → **📐 산림 분석 (SHP 자체 계산)** 섹션에 실측 표 표시.

## 다른 프로젝트 추가할 때

다른 프로젝트(예: 가평) 생성되면:
1. 원본 SHP 는 이미 `/data/forest/nationwide/` 에 있으므로 **재다운로드 불필요**
2. 새 프로젝트 컨테이너에 `/data/forest:ro` 바인드 마운트
3. 해당 프로젝트 `.env` 의 `PROJECT_BBOX` 를 가평 좌표로 설정
4. `ingest_forest_all --truncate` 한 번 실행 → 끝

원본 갱신 주기 (FGIS 임상도 5 년 / 산지구분도 연 1 회) 도래 시:
- 원본 ZIP 새로 받아 `/data/forest/nationwide/` 갱신
- 각 프로젝트 컨테이너에서 `ingest_forest_all --truncate` 순차 실행

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `FOREST_SHP_DIR 설정되지 않음` | 환경변수 누락 | `.env` 에 `FOREST_SHP_DIR=/data/forest` 추가 |
| `후보 파일 없음` | 파일명 다름 | `LAYER_FILENAME_CANDIDATES` 에 실제 이름 추가 or 심볼릭 링크 |
| `SHP CRS 미상` | .prj 결손 | `--srid-override 5179` 추가 (한국 SHP 표준) |
| 매칭 0 건 | BBOX 범위 밖 | `PROJECT_BBOX` 재확인. 양평 예시: `127.50,37.30,127.85,37.60` |
| pyogrio import error | 의존성 미설치 | 컨테이너 재빌드 (requirements.txt 업데이트됨) |
| 메모리 부족 | SHP 한 번에 메모리 로드 | `pyogrio.read_dataframe` 에 `bbox` 가 전달돼 이미 필터됨. 여전히 크면 BBOX 좁히기 |

## 관련 파일

- `backend/scripts/ingest_forest_shp.py` — 단일 레이어 적재 (함수 + CLI)
- `backend/scripts/ingest_forest_all.py` — 프로젝트 BBOX 로 전체 레이어 일괄
- `backend/app/services/forest_gis.py` — 속성 매핑 + shapely 교집합 분석
- `backend/app/routers/forest.py` — `/api/forest/*` 엔드포인트
- `backend/app/models/forest.py` — DB 스키마
- `frontend/public/legacy-map/landinfo.js` — 토지정보 모달 프론트
