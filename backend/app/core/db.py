from sqlmodel import SQLModel, Session, create_engine
from .config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args, pool_pre_ping=True)


def init_db() -> None:
    """모델 모듈 import 로 SQLModel 메타데이터 등록 → 테이블 생성."""
    from app.models import (  # noqa: F401
        user,
        parcel,
        ai_chat_log,
        email_log,
        download_log,
        forest,
        twinland_report,
        twinland_report_attachment,
    )
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
