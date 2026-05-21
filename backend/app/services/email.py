"""Email service — Resend API 우선, 실패/미설정 시 DB 로그만."""
from __future__ import annotations
from pathlib import Path
import logging

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlmodel import Session

from ..core.config import get_settings
from ..models.email_log import EmailLog

logger = logging.getLogger("joojooland.email")

settings = get_settings()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
    enable_async=False,
)


TEMPLATE_SUBJECTS = {
    "register_welcome": "[JooJooLand] 가입을 환영합니다",
    "upgrade_requested": "[JooJooLand] 투자자 등업 요청이 접수되었습니다",
    "upgrade_approved": "[JooJooLand] 투자자 등업이 승인되었습니다",
    "upgrade_rejected": "[JooJooLand] 투자자 등업 요청 결과 안내",
    "password_reset": "[JooJooLand] 비밀번호 재설정 안내",
    "lead_received": "[JooJooLand] 문의를 받았습니다",
    "admin_new_upgrade": "[JooJooLand Admin] 새 등업 요청",
    "admin_new_lead": "[JooJooLand Admin] 새 리드 등록",
}


def render_template(name: str, context: dict) -> tuple[str, str]:
    subject = TEMPLATE_SUBJECTS.get(name, f"[JooJooLand] {name}")
    try:
        template = _env.get_template(f"{name}.html")
        html = template.render(**context)
    except Exception as e:  # 템플릿 파일 미존재 등
        logger.warning("template render failed: %s — fallback plain", e)
        html = f"<p>{context.get('body', '')}</p>"
    return subject, html


def _post_resend(to_email: str, subject: str, html: str) -> str:
    """Resend API 호출 — 성공 시 provider id 반환, 실패 시 예외."""
    if not settings.resend_api_key:
        raise RuntimeError("no resend api key")
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    with httpx.Client(timeout=10.0) as client:
        r = client.post("https://api.resend.com/emails", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return data.get("id", "")


def send_email(db: Session, to_email: str, template: str, context: dict | None = None) -> EmailLog:
    context = context or {}
    subject, html = render_template(template, context)
    log = EmailLog(
        to_email=to_email,
        subject=subject,
        template=template,
        body_html=html,
        status="queued",
    )

    if not settings.resend_api_key:
        log.status = "logged"
        logger.info("[email:logged] to=%s tmpl=%s (no RESEND_API_KEY)", to_email, template)
    else:
        try:
            pid = _post_resend(to_email, subject, html)
            log.status = "sent"
            log.provider_id = pid
            logger.info("[email:sent] to=%s tmpl=%s id=%s", to_email, template, pid)
        except Exception as e:
            log.status = "failed"
            log.error = str(e)[:500]
            logger.error("[email:failed] to=%s tmpl=%s err=%s", to_email, template, e)

    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def resend(db: Session, log_id: int) -> EmailLog:
    log = db.get(EmailLog, log_id)
    if not log:
        raise ValueError("log not found")
    if not settings.resend_api_key:
        log.status = "logged"
        db.add(log); db.commit(); db.refresh(log)
        return log
    try:
        pid = _post_resend(log.to_email, log.subject, log.body_html or "")
        log.status = "sent"
        log.provider_id = pid
        log.error = None
    except Exception as e:
        log.status = "failed"
        log.error = str(e)[:500]
    db.add(log); db.commit(); db.refresh(log)
    return log
