"""Integracao de pagamentos com a Efi (ex-Gerencianet) — PIX entrada e saida.

DROP-IN replacement do asaas.py: mantem o MESMO router (prefix '/pix'), os mesmos
nomes de funcao publica (asaas_transferir_pix, asaas_consultar_chave,
asaas_consultar_transferencia) e as mesmas constantes (TRANSFER_DONE, TRANSFER_FAIL)
para que main.py precise de ZERO alteracoes alem do import.

Diferencas de arquitetura vs. Asaas (lidas da doc oficial dev.efipay.com.br):
1. Autenticacao OAuth2 (client_credentials) + mTLS obrigatorio com certificado .p12.
   O token expira (~1h); fazemos cache e refresh automatico.
2. Cobranca PIX: POST /v2/cob (txid gerado por nos) -> GET /v2/loc/{locId}/qrcode
   para pegar o copia-e-cola + imagem base64. Status: ATIVA / CONCLUIDA.
3. Saque (PIX Envio): PUT /v3/gn/pix/{idEnvio} (idempotente pelo idEnvio).
   Status: REALIZADO / NAO_REALIZADO.
4. A Efi NAO tem endpoint publico de consulta DICT standalone como o Asaas tinha
   (GET /pix/addressKeys/external). Portanto a trava antilavagem por CPF migra para
   o MOMENTO do envio: mandamos favorecido com a chave e validamos o CPF do titular
   que volta no retorno do Envio / webhook (campo gnExtras.favorecido.cpf, mascarado).
   asaas_consultar_chave aqui faz validacao LOCAL de formato (nao consulta titular);
   a checagem real de CPF acontece em conferir/no retorno do envio.

Variaveis de ambiente necessarias:
  EFI_CLIENT_ID            Client_Id da aplicacao Efi
  EFI_CLIENT_SECRET        Client_Secret da aplicacao Efi
  EFI_CERT_P12_BASE64      Certificado .p12 inteiro, codificado em base64
  EFI_CERT_PASSWORD        Senha do .p12 (vazio se nao tiver — Efi normalmente nao usa)
  EFI_PIX_KEY              Sua chave PIX recebedora/pagadora (cadastrada no painel)
  EFI_BASE_URL             https://pix.api.efipay.com.br (prod) ou
                           https://pix-h.api.efipay.com.br (homologacao)
  EFI_WEBHOOK_TOKEN        (opcional) token compartilhado p/ validar o webhook via
                           header 'x-efi-webhook-token' OU query ?token=... (ver nota)
"""
import os
import ssl
import base64
import tempfile
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import JogadorModel, CobrancaPixModel, registrar_transacao
from auth import obter_usuario_atual

router = APIRouter(prefix='/pix', tags=['pix'])

EFI_CLIENT_ID = os.getenv('EFI_CLIENT_ID', '')
EFI_CLIENT_SECRET = os.getenv('EFI_CLIENT_SECRET', '')
EFI_CERT_P12_BASE64 = os.getenv('EFI_CERT_P12_BASE64', '')
EFI_CERT_PASSWORD = os.getenv('EFI_CERT_PASSWORD', '')
EFI_PIX_KEY = os.getenv('EFI_PIX_KEY', '')
EFI_BASE = os.getenv('EFI_BASE_URL', 'https://pix.api.efipay.com.br').rstrip('/')
EFI_WEBHOOK_TOKEN = os.getenv('EFI_WEBHOOK_TOKEN', '')

# --- Status (verificados na doc dev.efipay.com.br) ---------------------------
# Cobranca (POST /v2/cob): ATIVA -> CONCLUIDA quando pago.
PAID_STATUSES = {'CONCLUIDA'}
CANCEL_STATUSES = {'REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'}
# A Efi nao "estorna" automaticamente uma cob; devolucoes sao via /v2/pix/{e2e}/devolucao.
# Tratamos devolucao como reversao quando o webhook traz o bloco 'devolucoes'.
REVERSAL_STATUSES: set[str] = set()  # reversao detectada por presenca de devolucao (ver webhook)
# PIX Envio (PUT /v3/gn/pix/{idEnvio}): REALIZADO / NAO_REALIZADO.
TRANSFER_DONE = {'REALIZADO', 'EM_PROCESSAMENTO'}  # EM_PROCESSAMENTO conta como iniciado-ok
TRANSFER_FAIL = {'NAO_REALIZADO', 'DEVOLVIDO', 'REJEITADO'}

# Tipos de chave aceitos (a Efi infere o tipo pela propria chave, mas mantemos o
# mapeamento para validar formato localmente e preservar a interface do asaas.py).
TIPOS_VALIDOS = {'cpf', 'email', 'telefone', 'aleatoria'}

# ---------------------------------------------------------------------------
# Infra: certificado mTLS + OAuth2 com cache de token
# ---------------------------------------------------------------------------
_cert_paths: tuple[str, str] | None = None
_token: dict | None = None  # {'access_token': str, 'exp': datetime}


def _materializar_cert() -> tuple[str, str]:
    """Decodifica o .p12 do env, extrai cert+key para arquivos PEM temporarios e
    retorna (cert_pem_path, key_pem_path) para o httpx usar em mTLS.
    Usa cryptography para abrir o PKCS#12 (sem depender de openssl no PATH)."""
    global _cert_paths
    if _cert_paths is not None:
        return _cert_paths
    if not EFI_CERT_P12_BASE64:
        raise HTTPException(503, 'Integracao Efi nao configurada (EFI_CERT_P12_BASE64).')
    from cryptography.hazmat.primitives.serialization import (
        pkcs12, Encoding, PrivateFormat, NoEncryption)
    raw = base64.b64decode(EFI_CERT_P12_BASE64)
    pwd = EFI_CERT_PASSWORD.encode() if EFI_CERT_PASSWORD else None
    key, cert, _extra = pkcs12.load_key_and_certificates(raw, pwd)
    if cert is None or key is None:
        raise HTTPException(503, 'Certificado .p12 invalido (cert/key ausente).')
    cert_pem = cert.public_bytes(Encoding.PEM)
    key_pem = key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    cdir = tempfile.mkdtemp(prefix='efi_cert_')
    cpath = os.path.join(cdir, 'cert.pem')
    kpath = os.path.join(cdir, 'key.pem')
    with open(cpath, 'wb') as f:
        f.write(cert_pem)
    with open(kpath, 'wb') as f:
        f.write(key_pem)
    os.chmod(kpath, 0o600)
    _cert_paths = (cpath, kpath)
    return _cert_paths


def _make_client() -> httpx.AsyncClient:
    """Cria um AsyncClient com mTLS configurado. Cada chamada cria/fecha o client
    (serverless-friendly; evita event-loop reuse entre invocacoes na Vercel)."""
    cpath, kpath = _materializar_cert()
    ctx = ssl.create_default_context()
    ctx.load_cert_chain(certfile=cpath, keyfile=kpath)
    return httpx.AsyncClient(base_url=EFI_BASE, verify=ctx, timeout=30,
                             headers={'User-Agent': 'camp-freefire'})


async def _get_token() -> str:
    """OAuth2 client_credentials com cache. Renova ~60s antes de expirar."""
    global _token
    now = datetime.now(timezone.utc)
    if _token and _token['exp'] > now:
        return _token['access_token']
    if not (EFI_CLIENT_ID and EFI_CLIENT_SECRET):
        raise HTTPException(503, 'Integracao Efi nao configurada (EFI_CLIENT_ID/SECRET).')
    basic = base64.b64encode(f'{EFI_CLIENT_ID}:{EFI_CLIENT_SECRET}'.encode()).decode()
    async with _make_client() as c:
        resp = await c.post('/oauth/token',
                            headers={'Authorization': f'Basic {basic}',
                                     'Content-Type': 'application/json'},
                            json={'grant_type': 'client_credentials'})
    if resp.status_code != 200:
        raise HTTPException(502, f'Falha OAuth Efi ({resp.status_code}): {resp.text[:300]}')
    data = resp.json()
    from datetime import timedelta
    expires = int(data.get('expires_in', 3600))
    _token = {'access_token': data['access_token'],
              'exp': now + timedelta(seconds=max(60, expires - 60))}
    return _token['access_token']


async def _api(method: str, path: str, json: dict | None = None) -> dict:
    """Chamada autenticada (Bearer + mTLS). Reautentica 1x em caso de 401."""
    token = await _get_token()
    async with _make_client() as c:
        resp = await c.request(method, path, json=json,
                              headers={'Authorization': f'Bearer {token}',
                                       'Content-Type': 'application/json'})
        if resp.status_code == 401:
            global _token
            _token = None
            token = await _get_token()
            resp = await c.request(method, path, json=json,
                                  headers={'Authorization': f'Bearer {token}',
                                           'Content-Type': 'application/json'})
    if resp.status_code not in (200, 201):
        raise HTTPException(502, f'Erro Efi ({resp.status_code}) em {path}: {resp.text[:300]}')
    return resp.json() if resp.content else {}


# ---------------------------------------------------------------------------
# Credito / estorno (identico em semantica ao asaas.py — ledger idempotente)
# ---------------------------------------------------------------------------
def _estornar_pagamento(db: Session, cobranca: CobrancaPixModel) -> bool:
    if cobranca.status == 'estornado':
        return False
    stmt = select(JogadorModel).where(JogadorModel.id == cobranca.jogador_id)
    if db.bind is not None and db.bind.dialect.name != 'sqlite':
        stmt = stmt.with_for_update()
    jogador = db.scalar(stmt)
    if not jogador:
        return False
    registrar_transacao(db, jogador, tipo='estorno_deposito_efi',
                        delta_saldo=-cobranca.valor, ref=f'cobranca:{cobranca.invoice_id}')
    cobranca.status = 'estornado'
    db.commit()
    return True


def _confirmar_pagamento(db: Session, cobranca: CobrancaPixModel) -> bool:
    if cobranca.status == 'pago':
        return False
    stmt = select(JogadorModel).where(JogadorModel.id == cobranca.jogador_id)
    if db.bind is not None and db.bind.dialect.name != 'sqlite':
        stmt = stmt.with_for_update()
    jogador = db.scalar(stmt)
    if not jogador:
        return False
    registrar_transacao(db, jogador, tipo='deposito_efi', delta_saldo=cobranca.valor,
                        ref=f'cobranca:{cobranca.invoice_id}')
    cobranca.status = 'pago'
    cobranca.pago_em = datetime.now(timezone.utc)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# COBRANCA PIX (entrada / deposito)
# ---------------------------------------------------------------------------
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


def _txid_novo(jogador_id: int) -> str:
    """txid valido p/ Efi: 26-35 chars, [a-zA-Z0-9]. Usamos prefixo + timestamp + rand."""
    import secrets
    base = f'DEP{jogador_id}{int(datetime.now(timezone.utc).timestamp())}'
    base += secrets.token_hex(8)
    return base[:35]


@router.post('/criar-cobranca', response_model=CobrancaResponse)
async def criar_cobranca_pix(body: CriarCobrancaRequest,
                             jogador: JogadorModel = Depends(obter_usuario_atual),
                             db: Session = Depends(get_db)):
    if body.valor < 1:
        raise HTTPException(400, 'Valor minimo: R$ 1,00')
    if body.valor > 1000:
        raise HTTPException(400, 'Valor maximo por deposito: R$ 1.000,00')
    cpf = body.cpf.replace('.', '').replace('-', '').strip()
    # Grava o CPF do titular no 1o deposito (necessario p/ travar o saque).
    if not jogador.cpf:
        if len(cpf) != 11 or not cpf.isdigit():
            raise HTTPException(400, 'CPF invalido (necessario no primeiro deposito)')
        jogador.cpf = cpf
        db.commit()

    if not EFI_PIX_KEY:
        raise HTTPException(503, 'Integracao Efi nao configurada (EFI_PIX_KEY).')

    txid = _txid_novo(jogador.id)
    cob_body = {
        'calendario': {'expiracao': 3600},
        'devedor': {'cpf': jogador.cpf or cpf,
                    'nome': jogador.nome or f'Jogador {jogador.id}'},
        'valor': {'original': f'{round(body.valor, 2):.2f}'},
        'chave': EFI_PIX_KEY,
        'solicitacaoPagador': f'Deposito Camp FreeFire - {jogador.nick}',
    }
    cob = await _api('PUT', f'/v2/cob/{txid}', cob_body)
    # invoice_id = txid (chave de reconciliacao no nosso banco)
    invoice_id = cob.get('txid', txid)
    loc_id = (cob.get('loc') or {}).get('id')
    status = cob.get('status', 'ATIVA')

    db.add(CobrancaPixModel(invoice_id=invoice_id, code=txid, jogador_id=jogador.id,
                            valor=body.valor, status='pendente'))
    db.commit()

    # Pega o copia-e-cola + imagem base64 do QR.
    qr_payload, qr_image, expiracao = '', '', ''
    if loc_id is not None:
        qr = await _api('GET', f'/v2/loc/{loc_id}/qrcode')
        qr_payload = qr.get('qrcode', '')
        qr_image = qr.get('imagemQrcode', '')  # ja vem como data:image/png;base64,...
    expiracao = (cob.get('calendario') or {}).get('criacao', '')

    return CobrancaResponse(
        invoice_id=invoice_id,
        qr_code=qr_payload,
        qr_code_image=qr_image,
        valor=body.valor,
        status=status,
        expiracao=expiracao,
    )


async def _consultar_cob(txid: str) -> dict:
    return await _api('GET', f'/v2/cob/{txid}')


@router.post('/webhook')
async def pix_webhook(request: Request, db: Session = Depends(get_db)):
    """Webhook da Efi. A Efi POSTa em /pix (ela acrescenta /pix ao final da URL
    cadastrada — por isso a rota efetiva costuma ser .../pix/webhook/pix; trate ambos
    no roteamento do main se necessario). Validamos token opcional e RECONSULTAMOS
    a cobranca na API antes de creditar (nunca confia no payload). Idempotente."""
    if EFI_WEBHOOK_TOKEN:
        token = (request.headers.get('x-efi-webhook-token')
                 or request.query_params.get('token') or '')
        if token != EFI_WEBHOOK_TOKEN:
            raise HTTPException(401, 'Token do webhook invalido')
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, 'JSON invalido')

    # Webhook de cobranca recebida: {'pix': [{'txid': ..., 'endToEndId': ...}, ...]}
    itens = body.get('pix', []) if isinstance(body, dict) else []
    if not itens:
        return {'received': True, 'known': False}

    resultados = []
    for item in itens:
        txid = item.get('txid', '')
        if not txid:
            continue
        cobranca = db.scalar(select(CobrancaPixModel)
                             .where(CobrancaPixModel.invoice_id == txid))
        if not cobranca:
            resultados.append({'txid': txid, 'known': False})
            continue
        if cobranca.status == 'estornado':
            resultados.append({'txid': txid, 'status': 'estornado'})
            continue

        # Devolucao apos credito -> reverte.
        if item.get('devolucoes') and cobranca.status == 'pago':
            estornado = _estornar_pagamento(db, cobranca)
            resultados.append({'txid': txid, 'status': 'estornado', 'estornado': estornado})
            continue

        dados = await _consultar_cob(txid)  # fonte de verdade
        status = (dados.get('status') or '').upper()
        if cobranca.status == 'pago':
            resultados.append({'txid': txid, 'status': 'pago', 'creditado': False})
            continue
        if status in PAID_STATUSES:
            creditado = _confirmar_pagamento(db, cobranca)
            resultados.append({'txid': txid, 'status': 'pago', 'creditado': creditado})
        elif status in CANCEL_STATUSES:
            cobranca.status = 'cancelado'
            db.commit()
            resultados.append({'txid': txid, 'status': 'cancelado'})
        else:
            resultados.append({'txid': txid, 'status': cobranca.status})
    return {'received': True, 'itens': resultados}


@router.get('/status/{invoice_id}')
async def status_cobranca(invoice_id: str,
                          jogador: JogadorModel = Depends(obter_usuario_atual),
                          db: Session = Depends(get_db)):
    cobranca = db.scalar(select(CobrancaPixModel)
                         .where(CobrancaPixModel.invoice_id == invoice_id))
    if not cobranca:
        raise HTTPException(404, 'Cobranca nao encontrada')
    if cobranca.jogador_id != jogador.id and not jogador.is_admin:
        raise HTTPException(403, 'Cobranca de outro jogador')
    if cobranca.status == 'pago':
        return {'invoice_id': invoice_id, 'status': 'CONCLUIDA', 'valor': cobranca.valor, 'pago': True}
    dados = await _consultar_cob(invoice_id)
    status = (dados.get('status') or '').upper()
    pago = status in PAID_STATUSES
    if pago:
        _confirmar_pagamento(db, cobranca)
    return {'invoice_id': invoice_id, 'status': status, 'valor': cobranca.valor, 'pago': pago}


# ====================== PIX ENVIO (saques) ==================================
# Interface mantida identica ao asaas.py para nao quebrar main.py.

def _id_envio(code: str) -> str:
    """idEnvio Efi: alfanumerico, ate 35 chars. Derivado do code (SAQ-{id})."""
    import re
    base = re.sub(r'[^a-zA-Z0-9]', '', code) or 'SAQ'
    import secrets
    return (base + secrets.token_hex(6))[:35]


async def asaas_transferir_pix(chave: str, tipo_chave: str, valor: float,
                               code: str, description: str = '') -> dict:
    """Envia PIX por chave (saque). Mantem a assinatura do asaas.py.
    Retorna dict normalizado contendo 'id' (=idEnvio) e 'status', para main.py."""
    if tipo_chave not in TIPOS_VALIDOS:
        raise HTTPException(400, 'Tipo de chave invalido')
    if not EFI_PIX_KEY:
        raise HTTPException(503, 'Integracao Efi nao configurada (EFI_PIX_KEY).')
    id_envio = _id_envio(code)
    payload = {
        'valor': f'{round(valor, 2):.2f}',
        'pagador': {'chave': EFI_PIX_KEY,
                    'infoPagador': (description or 'Saque Camp FreeFire')[:140]},
        'favorecido': {'chave': chave},
    }
    data = await _api('PUT', f'/v3/gn/pix/{id_envio}', payload)
    # Normaliza para o formato que main.py espera (espelho do Asaas: 'id'+'status').
    return {
        'id': data.get('idEnvio', id_envio),
        'status': data.get('status', 'EM_PROCESSAMENTO'),
        'e2eid': data.get('endToEndId', ''),
        'favorecido': data.get('favorecido', {}),
        '_raw': data,
    }


async def asaas_consultar_chave(tipo_chave: str, chave: str) -> dict:
    """A Efi NAO oferece consulta DICT de titular standalone (diferente do Asaas).
    Aqui validamos apenas o FORMATO da chave e devolvemos um dict no mesmo shape
    que main.py espera, com o titular DESCONHECIDO. A trava real de CPF acontece
    na conferencia do envio (favorecido.cpf no retorno/webhook).

    IMPORTANTE: como nao da pra validar o titular ANTES, main.py deve tratar o
    titular como 'a confirmar' e a divergencia de CPF e barrada no /conferir do saque,
    devolvendo o saldo se o CPF do favorecido nao bater com o do jogador.
    """
    chave = (chave or '').strip()
    if tipo_chave not in TIPOS_VALIDOS:
        raise HTTPException(400, 'Tipo de chave invalido')
    ok = False
    if tipo_chave == 'cpf':
        d = chave.replace('.', '').replace('-', '')
        ok = d.isdigit() and len(d) == 11
    elif tipo_chave == 'email':
        ok = '@' in chave and '.' in chave.split('@')[-1] and len(chave) <= 77
    elif tipo_chave == 'telefone':
        d = chave.replace('+', '').replace(' ', '').replace('-', '')
        ok = d.isdigit() and 10 <= len(d) <= 14
    elif tipo_chave == 'aleatoria':
        ok = len(chave) == 36 and chave.count('-') == 4
    if not ok:
        raise HTTPException(400, 'Chave PIX em formato invalido para o tipo informado.')
    # Shape compativel com _titular_da_chave() do main.py: sem dono confirmado.
    return {'_efi_no_dict_lookup': True, 'name': None, 'cpfCnpj': None, 'chave': chave}


async def asaas_consultar_transferencia(transfer_id: str) -> dict:
    """Consulta um PIX Envio pelo idEnvio (transfer_id == idEnvio).

    FIX homologacao: o path correto para consultar por idEnvio e
    GET /v2/gn/pix/enviados/id-envio/{idEnvio} (o path sem 'id-envio/' consulta
    por e2eId). Alem disso a Efi aninha o titular em
    favorecido.identificacao.{nome,cpf}; aqui achatamos para favorecido.{cpf,nome}
    para a trava antilavagem do main.py (favorecido.cpf) funcionar.
    """
    data = await _api('GET', f'/v2/gn/pix/enviados/id-envio/{transfer_id}')
    fav = dict(data.get('favorecido', {}) or {})
    ident = fav.get('identificacao') or {}
    if not fav.get('cpf'):
        fav['cpf'] = ident.get('cpf', '')
    if not fav.get('nome'):
        fav['nome'] = ident.get('nome', '')
    return {
        'id': data.get('idEnvio', transfer_id),
        'status': data.get('status', ''),
        'favorecido': fav,
        'e2eid': data.get('endToEndId', ''),
        '_raw': data,
    }
