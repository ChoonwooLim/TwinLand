from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "TwinLand GIS API"
    env: str = "development"

    database_url: str = "sqlite:///./twinland.db"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 15
    jwt_refresh_ttl_days: int = 30

    cookie_secure: bool = False
    cookie_domain: str = ""
    cookie_samesite: str = "lax"

    admin_email: str = "choonwoo49@gmail.com"
    admin_password: str = "changeme-on-first-boot"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Email
    resend_api_key: str = ""
    email_from: str = "noreply@twinland.twinverse.org"
    email_from_name: str = "TwinLand"
    password_reset_ttl_min: int = 30

    # Upload
    upload_dir: str = "./uploads"
    max_upload_mb: int = 200

    # Frontend URL (for email links)
    frontend_url: str = "http://localhost:5173"

    openclaw_ws_url: str = "ws://192.168.219.117:18789"
    openclaw_agent_pet: str = "twinland-gis-agent"
    openclaw_model_default: str = "anthropic/claude-opus-4-7"
    openclaw_model_agent: str = "openai-codex/gpt-5.4"
    openclaw_model_vision: str = "anthropic/claude-sonnet-4-6"

    ue5_signaling_url: str = "ws://192.168.219.117:8888"
    ue5_pixel_streamer_url: str = "http://192.168.219.117:8080"

    vworld_api_key: str = ""
    # VWorld 에 키 발급 시 등록한 서비스 URL 의 호스트명.
    # 브라우저가 localhost/개발 도메인에서 호출하더라도 백엔드 프록시가
    # 이 값으로 domain 파라미터를 덮어써야 INCORRECT_KEY 를 피할 수 있다.
    vworld_registered_domain: str = "twinland.twinverse.org"
    cesium_ion_token: str = ""

    # === 산림청 SHP 적재 설정 ===
    # 전국 SHP 원본이 풀려 있는 디렉토리 (Orbitron/로컬 공통 경로로 맞추기 권장).
    # 비워두면 CLI --file 인자로 직접 지정해야 함.
    forest_shp_dir: str = ""
    # 프로젝트 BBOX (lngMin,latMin,lngMax,latMax, EPSG:4326).
    # 이 범위로 SHP 를 잘라 DB 에 주입. 프로젝트마다 다르게 지정.
    project_bbox: str = "127.50,37.30,127.85,37.60"  # 양평 기본값
    project_name: str = "TwinLand"

    # 산사태위험등급 래스터 (GeoTIFF) 파일 경로 — 파셀별 zonal stats 계산용
    # 이전 'slope_raster_path' 였으나 실제 데이터가 산사태위험(DATA016)이라 정정.
    # .env 에서 둘 다 허용 (하위 호환).
    landslide_raster_path: str = ""
    slope_raster_path: str = ""  # 옛 이름 (env 호환)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
