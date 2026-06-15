"""Integracao de pagamentos com o Asaas (PIX entrada e saida).

Fluxos:
1. POST /pix/criar-cobranca (autenticado) -> cria cobranca PIX no Asaas e PERSISTE
   em cobrancas_pix; retorna QR code (payload copia-e-cola + imagem base64).
2. Asaas notifica POST /pix/webhook -> valida o token do header asaas-access-token
   e, por seguranca, NUNCA confia no payload: reconsulta a cobranca na API do Asaas
   antes de creditar o saldo (idempotente).
3. GET /pix/status/{id} -> fallback de polling; tambem credita se constar paga.
4. Saques: transferencia PIX por CHAVE via POST /transfers (instantanea).
"""
import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import JogadorModel, CobrancaPixModel, registrar_transacao
from auth import obter_usuario_atual

router = APIRouter(prefix='/pix', tags=['pix'])

ASAAS_API_KEY = os.getenv('ASAAS_API_KEY', '')
ASAAS_WEBHOOK_TOKEN = os.getenv('ASAAS_WEBHOOK_TOKEN', '')
ASAAS_BASE = os.getenv('ASAAS_BASE_URL', 'https://api.asaas.com/v3').rstrip('/')

PAID_STATUSES = {'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'}
CANCEL_STATUSES = {'REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'OVERDUE', 'DELETED'}
# Estornos que ocorrem APOS o pagamento ja ter sido creditado -> exigem reverter o saldo.
REVERSAL_STATUSES = {'REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE',
                     'AWAITING_CHARGEBACK_REVERSAL'}
TRANSFER_DONE = {'DONE'}
TRANSFER_FAIL = {'CANCELLED', 'FAILED'}

TIPO_CHAVE_ASAAS = {'cpf': 'CPF', 'email': 'EMAIL', 'telefone': 'PHONE', 'aleatoria': 'EVP'}

_http_client = None


def _get_client():
    global _http_client
    if not ASAAS_API_KEY:
        raise HTTPException(503, 'Integracao Asaas nao configurada (ASAAS_API_KEY).')
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=30, headers={
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'camp-freefire',
        })
    return _http_client


async def _api(method: str, path: str, json: dict | None = None) -> dict:
    c = _get_client()
    resp = await c.request(method, ASAAS_BASE + path, json=json)
    if resp.status_code not in (200, 201):
        raise HTTPException(502, f'Erro Asaas ({resp.status_code}) em {path}: {resp.text[:300]}')
    return resp.json()


async def _garantir_customer(jogador: JogadorModel, cpf: str, db: Session) -> str:
    # Grava o CPF do titular no 1o deposito (necessario para travar o saque).
    if cpf and not jogador.cpf:
        jogador.cpf = cpf
        db.commit()
    if jogador.asaas_customer_id:
        return jogador.asaas_customer_id
    data = await _api('POST', '/customers', {
        'name': jogador.nome or f'Jogador {jogador.id}',
        'cpfCnpj': cpf,
        'externalReference': f'jogador-{jogador.id}',
    })
    jogador.asaas_customer_id = data['id']
    db.commit()
    return data['id']


def _estornar_pagamento(db: Session, cobranca: CobrancaPixModel) -> bool:
    """Reverte um deposito ja creditado quando o PIX e estornado/chargeback.
    Idempotente (so estorna uma vez). O saldo PODE ficar negativo de proposito:
    se o jogador ja gastou/sacou, o negativo registra a divida e fica auditado no ledger."""
    if cobranca.status == 'estornado':
        return False
    stmt = select(JogadorModel).where(JogadorModel.id == cobranca.jogador_id)
    if db.bind is not None and db.bind.dialect.name != 'sqlite':
        stmt = stmt.with_for_update()
    jogador = db.scalar(stmt)
    if not jogador:
        return False
    registrar_transacao(db, jogador, tipo='estorno_deposito_asaas',
                        delta_saldo=-cobranca.valor, ref=f'cobranca:{cobranca.invoice_id}')
    cobranca.status = 'estornado'
    db.commit()
    return True


def _confirmar_pagamento(db: Session, cobranca: CobrancaPixModel) -> bool:
    """Credita o saldo do jogador. Idempotente: so credita uma vez."""
    if cobranca.status == 'pago':
        return False
    stmt = select(JogadorModel).where(JogadorModel.id == cobranca.jogador_id)
    if db.bind is not None and db.bind.dialect.name != 'sqlite':
        stmt = stmt.with_for_update()  # trava a linha: evita corrida de credito
    jogador = db.scalar(stmt)
    if not jogador:
        return False
    registrar_transacao(db, jogador, tipo='deposito_asaas', delta_saldo=cobranca.valor,
                        ref=f'cobranca:{cobranca.invoice_id}')
    cobranca.status = 'pago'
    cobranca.pago_em = datetime.now(timezone.utc)
    db.commit()
    return True


class CriarCobrancaRequest(BaseModel):
    valor: float
    cpf: str = ''


class CobrancaResponse(BaseModel):
    invoice_id: str
    qr_code: str
    qr_code_image: str
    valor: float
    status: str
    expiracao: str


@router.post('/criar-cobranca', response_model=CobrancaResponse)
async def criar_cobranca_pix(body: CriarCobrancaRequest,
                             jogador: JogadorModel = Depends(obter_usuario_atual),
                             db: Session = Depends(get_db)):
    if body.valor < 1:
        raise HTTPException(400, 'Valor minimo: R$ 1,00')
    if body.valor > 1000:
        raise HTTPException(400, 'Valor maximo por deposito: R$ 1.000,00')
    cpf = body.cpf.replace('.', '').replace('-', '').strip()
    if not jogador.asaas_customer_id and (len(cpf) != 11 or not cpf.isdigit()):
        raise HTTPException(400, 'CPF invalido (necessario no primeiro deposito)')
    customer = await _garantir_customer(jogador, cpf, db)
    now = datetime.now(timezone.utc)
    code = f'DEP-{jogador.id}-{int(now.timestamp())}'
    pagamento = await _api('POST', '/payments', {
        'customer': customer,
        'billingType': 'PIX',
        'value': round(body.valor, 2),
        'dueDate': (now + timedelta(days=2)).strftime('%Y-%m-%d'),
        'description': f'Deposito Camp FreeFire - {jogador.nick}',
        'externalReference': code,
    })
    invoice_id = pagamento['id']
    db.add(CobrancaPixModel(invoice_id=invoice_id, code=code, jogador_id=jogador.id,
                            valor=body.valor, status='pendente'))
    db.commit()
    qr = await _api('GET', f'/payments/{invoice_id}/pixQrCode')
    return CobrancaResponse(
        invoice_id=invoice_id,
        qr_code=qr.get('payload', ''),
        qr_code_image=qr.get('encodedImage', ''),
        valor=body.valor,
        status=pagamento.get('status', 'PENDING'),
        expiracao=qr.get('expirationDate', ''),
    )


@router.post('/webhook')
async def pix_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook do Asaas. Valida o token configurado e reconsulta a cobranca na API
    (nunca confia no payload). Idempotente."""
    if ASAAS_WEBHOOK_TOKEN:
        token = request.headers.get('asaas-access-token', '')
        if token != ASAAS_WEBHOOK_TOKEN:
            raise HTTPException(401, 'Token do webhook invalido')
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, 'JSON invalido')
    payment = body.get('payment', {}) if isinstance(body, dict) else {}
    invoice_id = payment.get('id') or body.get('id') or ''
    if not invoice_id:
        return {'received': True, 'known': False}

    cobranca = db.scalar(select(CobrancaPixModel).where(CobrancaPixModel.invoice_id == invoice_id))
    if not cobranca:
        return {'received': True, 'known': False}
    if cobranca.status == 'estornado':
        return {'received': True, 'status': 'estornado', 'estornado': False}

    dados = await _api('GET', f'/payments/{invoice_id}')  # fonte de verdade
    status = (dados.get('status') or '').upper()

    # Estorno/chargeback APOS pagamento ja creditado -> reverte o saldo.
    if cobranca.status == 'pago':
        if status in REVERSAL_STATUSES:
            estornado = _estornar_pagamento(db, cobranca)
            return {'received': True, 'status': 'estornado', 'estornado': estornado}
        return {'received': True, 'status': 'pago', 'creditado': False}

    if status in PAID_STATUSES:
        creditado = _confirmar_pagamento(db, cobranca)
        return {'received': True, 'status': 'pago', 'creditado': creditado}
    if status in CANCEL_STATUSES:
        cobranca.status = 'cancelado'
        db.commit()
    return {'received': True, 'status': cobranca.status, 'creditado': False}


@router.get('/status/{invoice_id}')
async def status_cobranca(invoice_id: str,
                          jogador: JogadorModel = Depends(obter_usuario_atual),
                          db: Session = Depends(get_db)):
    cobranca = db.scalar(select(CobrancaPixModel).where(CobrancaPixModel.invoice_id == invoice_id))
    if not cobranca:
        raise HTTPException(404, 'Cobranca nao encontrada')
    if cobranca.jogador_id != jogador.id and not jogador.is_admin:
        raise HTTPException(403, 'Cobranca de outro jogador')
    if cobranca.status == 'pago':
        return {'invoice_id': invoice_id, 'status': 'RECEIVED', 'valor': cobranca.valor, 'pago': True}
    dados = await _api('GET', f'/payments/{invoice_id}')
    status = (dados.get('status') or '').upper()
    pago = status in PAID_STATUSES
    if pago:
        _confirmar_pagamento(db, cobranca)
    return {'invoice_id': invoice_id, 'status': status, 'valor': cobranca.valor, 'pago': pago}


# ====================== TRANSFERENCIA PIX POR CHAVE (saques) ======================

async def asaas_transferir_pix(chave: str, tipo_chave: str, valor: float,
                               code: str, description: str = '') -> dict:
    tipo = TIPO_CHAVE_ASAAS.get(tipo_chave)
    if not tipo:
        raise HTTPException(400, 'Tipo de chave invalido')
    return await _api('POST', '/transfers', {
        'value': round(valor, 2),
        'pixAddressKey': chave,
        'pixAddressKeyType': tipo,
        'description': description or 'Saque Camp FreeFire',
        'externalReference': code,
    })


async def asaas_consultar_chave(tipo_chave: str, chave: str) -> dict:
    """Consulta o titular de uma chave PIX (qualquer tipo) no DICT via Asaas,
    para validar o dono ANTES da transferencia. Limite Asaas: 5 req/min.
    Retorna o dict bruto (inclui cpfCnpj mascarado e nome do titular)."""
    from urllib.parse import urlencode
    tipo = TIPO_CHAVE_ASAAS.get(tipo_chave)
    if not tipo:
        raise HTTPException(400, 'Tipo de chave invalido')
    qs = urlencode({'type': tipo, 'key': chave})
    return await _api('GET', f'/pix/addressKeys/external?{qs}')


async def asaas_consultar_transferencia(transfer_id: str) -> dict:
    return await _api('GET', f'/transfers/{transfer_id}')
