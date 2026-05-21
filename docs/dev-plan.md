# 개발계획서

JooJooLand (Pet Twinverse 투자 피치 사이트) 비전, 마일스톤, 기능 목록을 기록합니다.

상위 설계서: [specs/2026-04-22-joojooland-pitch-site-design.md](./superpowers/specs/2026-04-22-joojooland-pitch-site-design.md)
인증·어드민 설계서: [specs/2026-04-22-joojooland-auth-admin-design.md](./superpowers/specs/2026-04-22-joojooland-auth-admin-design.md)

## 마일스톤

| # | 이름 | 상태 | 목표일 |
|---|------|------|--------|
| 1 | Phase 0 — 프로젝트 스캐폴드 (React 19 + FastAPI + Postgres + Orbitron 배포) | 완료 | 2026-04-22 |
| 2 | Phase 1 — 마케팅 페이지 9종 + 지도(legacy-map iframe) + ko/en i18n | 완료 | 2026-04-22 |
| 3 | Phase 2 — 인증 + 어드민 대시보드 (4역할 · 14 메뉴 · Mantine) | 완료 | 2026-04-22 |
| 7 | Phase 2.5 — 지도 UX 전면 개편 (풀뷰포트·헤더 베이스맵 전환·토지정보 모달·2D/3D 스타일 통합) | 완료 | 2026-04-23 |
| 8 | Phase 2.6 — 산림청 SHP 자체 적재 파이프라인 (9 레이어 · PostGIS 없이 shapely) | 완료 | 2026-04-23 |
| 4 | Phase 3 — Demo 채팅 OpenClaw 실연결 + UE5 홀로그램 Wilbur 연결 | 진행예정 | TBD |
| 5 | Phase 4 — Map 모듈 React 네이티브 포팅 (JooJooPatLand → react-leaflet + resium) | 진행예정 | TBD |
| 6 | Phase 5 — Cloudflare Tunnel 정식 도메인 바인딩 + 투자자 실 라운드 런치 | 진행예정 | TBD |
| 9 | Phase 6 — 산지구분도/산사태위험지도 FGIS 추가 신청 + 적재 | 보류 | 승인 후 |

## 기능 목록

| 기능 | 상태 | 담당 | 메모 |
|------|------|------|------|
| Home (Hero + 문제·솔루션 + 통계) | 완료 | Steven | three.js 우주 VFX, 다크모드 |
| Vision (4기둥) | 완료 | Steven | 교차 레이아웃 |
| ThemePark (4존) | 완료 | Steven | 이모지+토큰 색상 |
| DigitalClone | 완료 | Steven | r3f 캔버스 placeholder, Phase 3 에서 3D 마운트 |
| Map (사업예정부지) | 완료 | Steven | legacy-map iframe + 5탭 GIS (Phase 4 에서 네이티브) |
| Demo (채팅 · 홀로그램) | 완료 | Steven | UI 완성, WS/WebRTC 는 Phase 3 실연결 |
| Investment (시장·로드맵·팀·재무) | 완료 | Steven | roadmap/team/financials 는 ContentBlock 으로 이관 예정 |
| DataRoom | 완료 | Steven | API 연동 + investor 게이트, 파일 업로드는 어드민에서 |
| Contact | 완료 | Steven | Mantine 폼 + /api/leads 제출 |
| Login/Register/Forgot/Reset | 완료 | Steven | httpOnly 쿠키 + refresh |
| Upgrade 신청 | 완료 | Steven | guest → investor 승격 플로우 |
| 어드민 — 대시보드 | 완료 | Steven | 8 stat cards + AreaChart |
| 어드민 — 사용자 관리 | 완료 | Steven | role/active 토글 + 삭제 |
| 어드민 — 등업 요청 | 완료 | Steven | Tabs + 승인/반려 Modal (이메일 자동발송) |
| 어드민 — 리드 관리 | 완료 | Steven | 7단계 파이프라인 + Drawer 편집 |
| 어드민 — DataRoom 문서 | 완료 | Steven | 업로드 + access_level + 다운로드 로그 |
| 어드민 — 콘텐츠 CMS | 완료 | Steven | roadmap/team/financials/home_stats ko/en 편집 |
| 어드민 — 부지 관리 | 완료 | Steven | Parcel CRUD (GeoJSON Textarea) |
| 어드민 — AI 로그 | 완료 | Steven | AIChatLog + 모델별 BarChart |
| 어드민 — 이메일 이력 | 완료 | Steven | 상태 필터 + 재전송 |
| 어드민 — Pet/Clone | 완료 | Steven | Pets/Clones 탭 (향후 3D 업로드 확장) |
| 어드민 — AI 스킬 | 완료 | Steven | .claude/skills 스캔 + fallback |
| 어드민 — 플러그인 | 완료 | Steven | MCP 설정 스캔 + fallback |
| 어드민 — 프로젝트 문서 | 완료 | Steven | Markdown 트리 뷰어 |
| 어드민 — 운영 모니터 | 완료 | Steven | OpenClaw ping + DB 레이턴시 |
| 이메일 발송 (Resend) | 완료 | Steven | RESEND_API_KEY 미설정 시 log-only |
| Postgres 자동 컬럼 보정 | 완료 | Steven | `_auto_migrate()` — ADD COLUMN IF NOT EXISTS |
| Demo OpenClaw 실연결 | 진행예정 | - | Phase 3 |
| UE5 Wilbur Pixel Streaming | 진행예정 | - | Phase 3 |
| Map 네이티브 포팅 | 진행예정 | - | Phase 4 |
| Cloudflare Tunnel 정식 도메인 | 진행예정 | - | Phase 5 |
| 프로덕션 secrets 교체 | 진행예정 | - | 배포 전 (JWT_SECRET, ADMIN_PASSWORD, COOKIE_SECURE=true) |
| 2FA (이메일 OTP) | 보류 | - | 투자자 규모 확장 시 검토 |
| Cloudflare R2 파일 이관 | 보류 | - | DataRoom 파일 용량 증가 시 |
| 지도 — 2D/3D 필지 스타일 통합 (색·투명도·외곽선·단일색 토글) | 완료 | Steven | 2026-04-23 |
| 지도 — 헤더 베이스맵 빠른 전환 (VWorld/Esri/OSM/지형) | 완료 | Steven | 2026-04-23 |
| 지도 — 인접 레이어 2D/3D 동시 렌더 + 인라인 색·투명도 | 완료 | Steven | 2026-04-23 |
| 지도 — 📊 토지정보 모달 (7 섹션 통계 + 실측 API) | 완료 | Steven | 2026-04-23 |
| 지도 — 맵 페이지 풀뷰포트 (히어로 제거·풋터 숨김) | 완료 | Steven | 2026-04-23 |
| VWorld 프록시 domain 강제 (INCORRECT_KEY 근본 해결) | 완료 | Steven | 2026-04-23 |
| 산림청 SHP 적재 파이프라인 (shapely, 9 레이어) | 완료 | Steven | 2026-04-23 |
| 산림 분석 API — analyze(-batch) / nearby-poi / forest-roads / landslide-batch | 완료 | Steven | 2026-04-23 |
| 산사태위험등급 래스터 zonal stats | 완료 | Steven | 2026-04-23 |
| 임도망 (LineString) 최근접 거리·교차 여부 분석 | 완료 | Steven | 2026-04-23 |
| FGIS 산지구분도 추가 신청·적재 | 진행예정 | - | FGIS 다운로드 카탈로그에서 확인 필요 |
| 양평 외 타 프로젝트용 BBOX 기반 재적재 명령 | 진행예정 | - | 전국 SHP 원본 1회 배포 후 재사용 |
