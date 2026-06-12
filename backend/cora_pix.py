"""Integracao PIX com a Cora Bank (mTLS).

Fluxo:
1. POST /pix/criar-cobranca (autenticado) -> cria invoice na Cora e PERSISTE em cobrancas_pix
2. Cora notifica POST /pix/webhook -> NUNCA confiamos no payload: reconsultamos a invoice
   na API da Cora via mTLS e so entao creditamos o saldo (idempotente).
3. GET /pix/status/{invoice_id} -> fallback de polling; tambem credita se constar paga.
"""
import os
import base64
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import JogadorModel, CobrancaPixModel
from auth import obter_usuario_atual

router = APIRouter(prefix='/pix', tags=['pix'])

CORA_CLIENT_ID = os.getenv('CORA_CLIENT_ID', '')
CORA_CERT_B64 = os.getenv('CORA_CERT_B64', '')
CORA_KEY_B64 = os.getenv('CORA_KEY_B64', '')
CORA_BASE = os.getenv('CORA_BASE_URL', 'https://matls-clients.api.cora.com.br')
CORA_AUTH_URL = CORA_BASE + '/token'

_token_cache: dict = {}
_cert_paths: dict = {}
_http_client = None
PAID_STATUSES = {'PAID', 'COMPLETE', 'COMPLETED', 'SETTLED'}


def _get_cert_files():
    """Grava os certificados mTLS em arquivos temporarios UMA vez e reutiliza."""
    if not (CORA_CLIENT_ID and CORA_CERT_B64 and CORA_KEY_B64):
        raise HTTPException(503, 'Integracao Cora nao configurada (CORA_CLIENT_ID, CORA_CERT_B64, CORA_KEY_B64).')
    if _cert_paths.get('cert') and os.path.exists(_cert_paths['cert']) and os.path.exists(_cert_paths['key']):
        return _cert_paths['cert'], _cert_paths['key']
    cf = tempfile.NamedTemporaryFile(suffix='.crt', delete=False)
    kf = tempfile.NamedTemporaryFile(suffix='.key', delete=False)
    cf.write(base64.b64decode(CORA_CERT_B64)); cf.flush(); cf.close()
    kf.write(base64.b64decode(CORA_KEY_B64)); kf.flush(); kf.close()
    _cert_paths['cert'], _cert_paths['key'] = cf.name, kf.name
    return cf.name, kf.name


def _get_client():
    """Reutiliza um unico AsyncClient mTLS (handshake mTLS e caro)."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(cert=_get_cert_files(), verify=True, timeout=30)
    return _http_client


async def get_cora_token() -> str:
    now = datetime.now(timezone.utc)
    if _token_cache.get('token') and _token_cache.get('expires_at', now) > now:
        return _token_cache['token']
    c = _get_client()
    resp = await c.post(
        CORA_AUTH_URL,
        data={'grant_type': 'client_credentials', 'client_id': CORA_CLIENT_ID},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    if resp.status_code != 200:
        raise HTTPException(502, 'Erro de autenticacao na Cora: ' + resp.text[:300])
    data = resp.json()
    _token_cache['token'] = data['access_token']
    _token_cache['expires_at'] = now + timedelta(seconds=data.get('expires_in', 3600) - 60)
    return _token_cache['token']


async def _cora_get_invoice(invoice_id: str) -> dict:
    """Busca a invoice direto na Cora (fonte de verdade, via mTLS)."""
    tkn = await get_cora_token()
    c = _get_client()
    resp = await c.get(CORA_BASE + '/v2/invoices/' + invoice_id,
                       headers={'Authorization': 'Bearer ' + tkn})
    if resp.status_code != 200:
        raise HTTPException(404, 'Cobranca nao encontrada na Cora')
    return resp.json()


def _confirmar_pagamento(db: Session, cobranca: CobrancaPixModel) -> bool:
    """Credita o saldo do jogador. Idempotente: so credita uma vez."""
    if cobranca.status == 'pago':
        return False
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.id == cobranca.jogador_id))
    if not jogador:
        return False
    jogador.saldo += cobranca.valor
    cobranca.status = 'pago'
    cobranca.pago_em = datetime.now(timezone.utc)
    db.commit()
    return True


class CriarCobrancaRequest(BaseModel):
    valor: float
    cpf: str = '00000000000'


class CobrancaResponse(BaseModel):
    invoice_id: str
    qr_code: str
    qr_code_image: str
    valor: float
    status: str
    expiracao: str


@router.post('/criar-cobranca', response_model=CobrancaResponse)
async def criar_cobranca_pix(
    body: CriarCobrancaRequest,
    jogador: JogadorModel = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
):
    if body.valor < 1:
        raise HTTPException(400, 'Valor minimo: R$ 1,00')
    if body.valor > 1000:
        raise HTTPException(400, 'Valor maximo por deposito: R$ 1.000,00')
    tkn = await get_cora_token()
    c = _get_client()
    now = datetime.now(timezone.utc)
    code = f'DEP-{jogador.id}-{int(now.timestamp())}'
    payload = {
        'code': code,
        'services': [{
            'name': 'Deposito FreeFire',
            'description': f'Deposito Camp FreeFire - {jogador.nick}',
            'amount': int(round(body.valor * 100)),
        }],
        'payment_forms': ['PIX'],
        'payment_terms': {'due_date': (now + timedelta(days=3)).strftime('%Y-%m-%d')},
        'customer': {
            'name': jogador.nome or f'Jogador {jogador.id}',
            'document': {
                'identity': body.cpf.replace('.', '').replace('-', '').replace('/', ''),
                'type': 'CPF',
            },
        },
    }
    # Idempotency-Key derivada do code: reenvio da MESMA transacao nao duplica fatura
    idem_key = str(uuid.uuid5(uuid.NAMESPACE_URL, 'cora-invoice:' + code))
    resp = await c.post(
        CORA_BASE + '/v2/invoices', json=payload,
        headers={'Authorization': 'Bearer ' + tkn, 'Idempotency-Key': idem_key},
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(502, f'Erro Cora ({resp.status_code}): {resp.text[:300]}')
    data = resp.json()
    invoice_id = data.get('id', '')
    if not invoice_id:
        raise HTTPException(502, 'Cora nao retornou o ID da cobranca.')

    # PERSISTE a cobranca para conciliacao posterior pelo webhook/polling
    db.add(CobrancaPixModel(invoice_id=invoice_id, code=code, jogador_id=jogador.id,
                            valor=body.valor, status='pendente'))
    db.commit()

    pix = data.get('pix') or data.get('payment_options', {}).get('pix') or {}
    qr_code = pix.get('emv') or pix.get('qr_code') or pix.get('copy_paste') or ''
    qr_image = pix.get('image_base64') or pix.get('qr_code_image') or ''
    if not qr_code:
        import asyncio
        for _ in range(3):  # tentativas curtas em vez de bloquear 2s
            await asyncio.sleep(0.4)
            r2 = await c.get(CORA_BASE + f'/v2/invoices/{invoice_id}/pix',
                             headers={'Authorization': 'Bearer ' + tkn})
            if r2.status_code == 200:
                p2 = r2.json()
                qr_code = p2.get('emv') or p2.get('qr_code') or p2.get('copy_paste') or ''
                qr_image = p2.get('image_base64') or p2.get('qr_code_image') or ''
            if qr_code:
                break
    return CobrancaResponse(
        invoice_id=invoice_id, qr_code=qr_code, qr_code_image=qr_image,
        valor=body.valor, status=data.get('status', 'PENDING'),
        expiracao=(now + timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%SZ'),
    )


@router.post('/webhook')
async def pix_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook da Cora. O payload NAO e confiavel: qualquer um pode fazer POST aqui.
    Por isso, apenas extraimos o invoice_id e confirmamos o status direto na API da
    Cora (mTLS) antes de creditar. Idempotente."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, 'JSON invalido')
    data = body.get('data', body) if isinstance(body, dict) else {}
    invoice_id = (request.headers.get('webhook-resource-id')
                  or data.get('id') or data.get('invoice_id')
                  or body.get('id') or body.get('invoice_id') or '')
    if not invoice_id:
        raise HTTPException(400, 'invoice_id ausente no webhook')

    cobranca = db.scalar(select(CobrancaPixModel).where(CobrancaPixModel.invoice_id == invoice_id))
    if not cobranca:
        # Nao conhecemos esta cobranca: responde 200 para a Cora nao reenviar eternamente
        return {'received': True, 'known': False}
    if cobranca.status == 'pago':
        return {'received': True, 'status': 'pago', 'creditado': False}

    invoice = await _cora_get_invoice(invoice_id)  # fonte de verdade
    status_cora = (invoice.get('status') or '').upper()
    if status_cora in PAID_STATUSES:
        creditado = _confirmar_pagamento(db, cobranca)
        return {'received': True, 'status': 'pago', 'creditado': creditado}
    if status_cora in ('CANCELLED', 'CANCELED', 'EXPIRED'):
        cobranca.status = 'cancelado'
        db.commit()
    return {'received': True, 'status': cobranca.status, 'creditado': False}


@router.get('/status/{invoice_id}')
async def status_cobranca(
    invoice_id: str,
    jogador: JogadorModel = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
):
    """Polling de status pelo frontend. Tambem credita (idempotente) se constar paga."""
    cobranca = db.scalar(select(CobrancaPixModel).where(CobrancaPixModel.invoice_id == invoice_id))
    if not cobranca:
        raise HTTPException(404, 'Cobranca nao encontrada')
    if cobranca.jogador_id != jogador.id and not jogador.is_admin:
        raise HTTPException(403, 'Cobranca de outro jogador')
    if cobranca.status == 'pago':
        return {'invoice_id': invoice_id, 'status': 'PAID', 'valor': cobranca.valor, 'pago': True}

    invoice = await _cora_get_invoice(invoice_id)
    status_cora = (invoice.get('status') or '').upper()
    pago = status_cora in PAID_STATUSES
    if pago:
        _confirmar_pagamento(db, cobranca)
    return {'invoice_id': invoice_id, 'status': status_cora, 'valor': cobranca.valor, 'pago': pago}
