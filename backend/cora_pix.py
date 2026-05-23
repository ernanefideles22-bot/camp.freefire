import os, base64, tempfile, uuid
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/pix", tags=["pix"])
CORA_CLIENT_ID = os.getenv("CORA_CLIENT_ID", "int-48bwiGVJx0Nqaxhm53ZKz7")
CORA_CERT_B64  = os.getenv("CORA_CERT_B64", "")
CORA_KEY_B64   = os.getenv("CORA_KEY_B64", "")
CORA_BASE      = "https://matls-clients.api.cora.com.br"
CORA_AUTH_URL  = "https://matls-clients.api.cora.com.br/token"
CORA_AUTH_URL_V2 = "https://matls-clients.api.cora.com.br/oauth2/token"
_token_cache = {}

def _get_cert_files():
    if not CORA_CERT_B64 or not CORA_KEY_B64:
        raise HTTPException(503, "Cert Cora nao configurado. Adicione CORA_CERT_B64 e CORA_KEY_B64 no Railway.")
    cf = tempfile.NamedTemporaryFile(suffix=".crt", delete=False)
    kf = tempfile.NamedTemporaryFile(suffix=".key", delete=False)
    cf.write(base64.b64decode(CORA_CERT_B64)); cf.flush()
    kf.write(base64.b64decode(CORA_KEY_B64));  kf.flush()
    return cf.name, kf.name

async def get_cora_token():
    now = datetime.utcnow()
    if _token_cache.get("token") and _token_cache.get("expires_at", now) > now:
        return _token_cache["token"]
    cert_path, key_path = _get_cert_files()
    async with httpx.AsyncClient(cert=(cert_path, key_path), verify=True) as c:
        resp = await c.post(CORA_AUTH_URL, data={"grant_type": "client_credentials", "client_id": CORA_CLIENT_ID}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    if resp.status_code != 200:
        raise HTTPException(502, "Erro auth Cora: " + resp.text)
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + timedelta(seconds=data.get("expires_in", 3600) - 60)
    return _token_cache["token"]

class CriarCobrancaRequest(BaseModel):
    jogador_id: int
    valor: float

class CobrancaResponse(BaseModel):
    invoice_id: str
    qr_code: str
    qr_code_image: str
    valor: float
    status: str
    expiracao: str

@router.post("/criar-cobranca", response_model=CobrancaResponse)
async def criar_cobranca_pix(body: CriarCobrancaRequest):
    tkn = await get_cora_token()
    cp, kp = _get_cert_files()
    exp = (datetime.utcnow() + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    wh = os.getenv("BACKEND_URL", "").rstrip("/") + "/pix/webhook"
    payload = {"code": "DEP-" + str(body.jogador_id) + "-" + str(int(datetime.utcnow().timestamp())), "amount": int(body.valor * 100), "description": "Deposito Camp FreeFire", "payment_forms": ["PIX"], "customer": {"name": "Jogador #" + str(body.jogador_id)}, "notifications": [{"channel": "WEBHOOK", "url": wh}]}
    async with httpx.AsyncClient(cert=(cp, kp), verify=True) as c:
        resp = await c.post(CORA_BASE + "/v2/invoices", json=payload, headers={"Authorization": "Bearer " + tkn, "Idempotency-Key": str(uuid.uuid4())})
    if resp.status_code not in (200, 201):
        raise HTTPException(502, "Erro Cora: " + resp.text)
    data = resp.json()
    pix = data.get("payment_options", {}).get("pix", {})
    return CobrancaResponse(invoice_id=data.get("id",""), qr_code=pix.get("emv",""), qr_code_image=pix.get("qr_code_image",""), valor=body.valor, status=data.get("status","PENDING"), expiracao=exp)

@router.post("/webhook")
async def pix_webhook(request: Request):
    body = await request.json()
    st, iid, val = body.get("status",""), body.get("id",""), body.get("amount",0)/100
    print("[CORA] invoice=" + iid + " status=" + st + " valor=" + str(val))
    return {"received": True, "invoice_id": iid, "status": st}

@router.get("/status/{invoice_id}")
async def status_cobranca(invoice_id: str):
    tkn = await get_cora_token()
    cp, kp = _get_cert_files()
    async with httpx.AsyncClient(cert=(cp, kp), verify=True) as c:
        resp = await c.get(CORA_BASE + "/v2/invoices/" + invoice_id, headers={"Authorization": "Bearer " + tkn})
    if resp.status_code != 200:
        raise HTTPException(404, "Cobranca nao encontrada")
    data = resp.json()
    return {"invoice_id": invoice_id, "status": data.get("status"), "valor": data.get("amount",0)/100, "pago": data.get("status") in ("PAID","COMPLETE")}