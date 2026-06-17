"""v3 클라이언트 라이브 검증 프로브.
실행:
  cd backend && .venv/Scripts/python -m scripts.spike_openclaw_v3 connect   # connect + agents.list
  cd backend && .venv/Scripts/python -m scripts.spike_openclaw_v3 chat       # Orbi 텍스트 ping
  cd backend && .venv/Scripts/python -m scripts.spike_openclaw_v3 image <path>  # 이미지 업로드+추출 시도
전제: backend/.env 에 OPENCLAW_TOKEN 설정.
"""
import asyncio
import base64
import sys

from app.services.openclaw_v3 import OpenClawV3
from app.core.config import get_settings

settings = get_settings()


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "connect"
    print(f"token set: {bool(settings.openclaw_token)} url={settings.openclaw_v3_ws_url} agent={settings.openclaw_agent}")
    async with OpenClawV3() as oc:
        print("CONNECTED")
        agents = await oc.agents_list()
        print("AGENTS:", [(a.get("name"), a.get("id")) for a in agents])
        if mode == "connect":
            return
        aid = await oc.resolve_agent_id(settings.openclaw_agent)
        print("Orbi agentId:", aid)
        if mode == "chat":
            resp = await oc.chat_send(aid, "twinland-probe", "ping. 한 단어로만 답해.", timeout=120)
            print("CHAT RESP:", repr(resp))
        elif mode == "image":
            path = sys.argv[2]
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            # base64 텍스트로 업로드 → Claude 가 디코드 후 Read
            fname = "twinland_scan.b64"
            try:
                r = await oc.files_set(aid, fname, b64)
                print("files.set ok:", r)
            except Exception as e:
                print("files.set FAILED:", e)
            prompt = (
                f"너의 워크스페이스에 '{fname}' 파일이 있다(base64 인코딩된 PNG). "
                f"먼저 쉘에서 `base64 -d {fname} > twinland_scan.png` 로 디코드한 뒤, "
                "그 PNG 이미지를 Read 도구로 열어서 봐. 한국 지적도/지번 목록 이미지야. "
                "보이는 모든 필지의 동/리(리 이름)와 지번을 추출해서 "
                '오직 JSON 배열로만 답해: [{"location":"리이름","lot":"지번"}]. '
                "지번은 '384-18' 또는 '산31' 형식. 설명·코드펜스 없이 JSON 만."
            )
            resp = await oc.chat_send(aid, "twinland-probe", prompt, timeout=300)
            print("IMAGE RESP:", repr(resp[:3000]))


if __name__ == "__main__":
    asyncio.run(main())
