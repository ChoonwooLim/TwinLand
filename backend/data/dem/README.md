# DEM (수치표고모델) 배치 위치

경사도분석용 **NGII 5m DEM** 파일을 여기에 둔다.

- 수급·배치 방법: [`docs/dem-ingest.md`](../../../docs/dem-ingest.md)
- 사용 코드: `backend/app/services/terrain.py`
- 계획: [`docs/superpowers/plans/2026-05-30-slope-analysis.md`](../../../docs/superpowers/plans/2026-05-30-slope-analysis.md)

`.img` / `.tif` 파일을 그대로 두면 됨 (코드가 디렉토리에서 필지 포함 타일을 탐색).
DEM 원본은 용량이 커서 **git 에 커밋하지 않는다**(이 폴더 `.gitignore` 참조).
환경변수 `DEM_DIR` 로 경로 변경 가능(기본 `backend/data/dem`).
