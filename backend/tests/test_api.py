"""Testes das rotas criticas: auth, inscricao, PIX, OCR."""
import os
import sys

os.environ['SECRET_KEY'] = 'test-secret'
os.environ['DATABASE_URL'] = 'sqlite://'  # em memoria... sqlite:// nao persiste entre conexoes
# usamos arquivo temporario para compartilhar entre sessoes
import tempfile
_dbfile = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
os.environ['DATABASE_URL'] = f'sqlite:///{_dbfile.name}'

os.environ['ADMIN_NICKS'] = 'admin1'
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient

import main
import models
import efi
import asaas  # rollback deve continuar importavel
from database import SessionLocal

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def _clean_db():
    yield
    # limpa tabelas entre testes? Nao: os testes sao sequenciais e dependem de estado proprio.


def _login(nick, senha):
    r = client.post('/auth/login', json={'nick': nick, 'senha': senha})
    assert r.status_code == 200, r.text
    return r.json()


def _auth(token):
    return {'Authorization': f'Bearer {token}'}


def _set_cpf(nick, cpf):
    from sqlalchemy import select
    db = SessionLocal()
    try:
        j = db.scalar(select(models.JogadorModel).where(models.JogadorModel.nick == nick))
        if j is not None:
            j.cpf = cpf
            db.commit()
    finally:
        db.close()


def _set_saldo(nick, saldo, sacavel=None):
    from sqlalchemy import select
    db = SessionLocal()
    try:
        j = db.scalar(select(models.JogadorModel).where(models.JogadorModel.nick == nick))
        if j is not None:
            j.saldo = saldo
            j.saldo_sacavel = saldo if sacavel is None else sacavel
            db.commit()
    finally:
        db.close()


# ====================== AUTH ======================

def test_cadastro_primeiro_usuario_e_admin():
    r = client.post('/auth/cadastro', json={'nome': 'Admin', 'nick': 'admin1', 'senha': 'secret123', 'aceitou_termos': True, 'confirma_idade': True})
    assert r.status_code == 200
    assert r.json()['is_admin'] is True


def test_cadastro_nick_duplicado():
    r = client.post('/auth/cadastro', json={'nome': 'X', 'nick': 'admin1', 'senha': 'secret123'})
    assert r.status_code == 400


def test_cadastro_sem_senha_rejeitado():
    r = client.post('/auth/cadastro', json={'nome': 'X', 'nick': 'semsenha'})
    assert r.status_code == 400


def test_login_e_me():
    data = _login('admin1', 'secret123')
    assert 'access_token' in data and 'refresh_token' in data
    r = client.get('/me', headers=_auth(data['access_token']))
    assert r.status_code == 200
    assert r.json()['nick'] == 'admin1'


def test_login_senha_errada():
    r = client.post('/auth/login', json={'nick': 'admin1', 'senha': 'errada123'})
    assert r.status_code == 401


def test_me_sem_token():
    assert client.get('/me').status_code in (401, 403)


def test_me_token_invalido():
    assert client.get('/me', headers=_auth('abc.def.ghi')).status_code == 401


def test_refresh_token():
    data = _login('admin1', 'secret123')
    r = client.post('/auth/refresh', json={'refresh_token': data['refresh_token']})
    assert r.status_code == 200
    assert 'access_token' in r.json()
    # access token nao serve como refresh
    r2 = client.post('/auth/refresh', json={'refresh_token': data['access_token']})
    assert r2.status_code == 401


# ====================== INSCRICAO ======================

def test_inscricao_fluxo_completo():
    client.post('/auth/cadastro', json={'nome': 'Player', 'nick': 'player1', 'senha': 'secret123', 'aceitou_termos': True, 'confirma_idade': True})
    tok = _login('player1', 'secret123')['access_token']
    admin_tok = _login('admin1', 'secret123')['access_token']

    # sem saldo -> 400
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 400

    pid = client.get('/me', headers=_auth(tok)).json()['id']

    # so admin credita (credito manual com motivo); R$ 10 nao-sacavel
    r = client.post('/depositos/manual', json={'jogador_id': pid, 'valor': 10.0, 'motivo': 'credito teste'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text

    # jogador comum nao pode creditar (endpoint e admin-only)
    r = client.post('/depositos/manual', json={'jogador_id': pid, 'valor': 5.0, 'motivo': 'tentativa'}, headers=_auth(tok))
    assert r.status_code == 403

    # com saldo -> inscreve
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 200
    # inscricao duplicada -> 400
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 400

    # saldo debitado (10 - 3 = 7; TAXA_INSCRICAO=3.0)
    me = client.get('/me', headers=_auth(tok)).json()
    assert me['saldo'] == 7.0

    # sala so visivel para inscrito apos liberacao
    r = client.get('/queda/1/sala', headers=_auth(tok))
    assert r.status_code == 404
    r = client.post('/queda/1/sala', json={'sala_id': 'SALA99', 'sala_senha': '1234'}, headers=_auth(admin_tok))
    assert r.status_code == 200
    r = client.get('/queda/1/sala', headers=_auth(tok))
    assert r.status_code == 200
    assert r.json()['sala_id'] == 'SALA99'


def test_resultado_e_classificacao():
    admin_tok = _login('admin1', 'secret123')['access_token']
    me = client.post('/auth/login', json={'nick': 'player1', 'senha': 'secret123'}).json()['jogador']
    r = client.post('/queda/1/resultado', json={
        'numero_queda': 1,
        'resultados': [{'jogador_id': me['id'], 'colocacao': 1, 'abates': 4}],
    }, headers=_auth(admin_tok))
    assert r.status_code == 200
    # premio: 20 + 4*0.5 = 22; pontos LBFF: 12 + 4 = 16
    r = client.get('/classificacao')
    assert r.status_code == 200
    item = next(i for i in r.json() if i['nick'] == 'player1')
    assert item['total_premios'] == 16.0  # 15 base + 4*0.25
    assert item['total_pontos'] == 16
    assert item['posicao'] == 1
    # resultado duplicado -> 400
    r = client.post('/queda/1/resultado', json={
        'numero_queda': 1,
        'resultados': [{'jogador_id': me['id'], 'colocacao': 2, 'abates': 0}],
    }, headers=_auth(admin_tok))
    assert r.status_code == 400


# ====================== PIX (Cora mockada) ======================

def test_pix_criar_cobranca_exige_auth():
    r = client.post('/pix/criar-cobranca', json={'valor': 10, 'cpf': '12345678901'})
    assert r.status_code in (401, 403)


def test_pix_fluxo_webhook(monkeypatch):
    tok = _login('player1', 'secret123')['access_token']
    monkeypatch.setattr(efi, 'EFI_PIX_KEY', 'chave-recebedora-test')
    monkeypatch.setattr(efi, 'EFI_WEBHOOK_TOKEN', 'tok-webhook')

    COB = {'status': 'ATIVA'}

    async def fake_api(method, path, json=None):
        if method == 'PUT' and path.startswith('/v2/cob/'):
            txid = path.rsplit('/', 1)[-1]
            return {'txid': txid, 'status': 'ATIVA', 'loc': {'id': 1},
                    'calendario': {'criacao': '2026-01-01T00:00:00Z'}}
        if method == 'GET' and path == '/v2/loc/1/qrcode':
            return {'qrcode': '000201-efi-emv', 'imagemQrcode': 'data:image/png;base64,AAA'}
        if method == 'GET' and path.startswith('/v2/cob/'):
            return {'status': COB['status']}
        raise AssertionError(f'chamada inesperada: {method} {path}')

    monkeypatch.setattr(efi, '_api', fake_api)

    r = client.post('/pix/criar-cobranca', json={'valor': 15.0, 'cpf': '123.456.789-01'},
                    headers=_auth(tok))
    assert r.status_code == 200, r.text
    data = r.json()
    inv = data['invoice_id']
    assert inv and data['qr_code'] == '000201-efi-emv'
    assert data['qr_code_image'].startswith('data:image/png;base64,')

    saldo_antes = client.get('/me', headers=_auth(tok)).json()['saldo']

    # webhook sem token -> 401
    r = client.post('/pix/webhook', json={'pix': [{'txid': inv}]})
    assert r.status_code == 401

    H = {'x-efi-webhook-token': 'tok-webhook'}
    # cobranca ainda ATIVA -> nao credita
    r = client.post('/pix/webhook', json={'pix': [{'txid': inv}]}, headers=H)
    assert r.status_code == 200
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes

    # CONCLUIDA -> credita
    COB['status'] = 'CONCLUIDA'
    r = client.post('/pix/webhook', json={'pix': [{'txid': inv}]}, headers=H)
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    # idempotencia
    r = client.post('/pix/webhook', json={'pix': [{'txid': inv}]}, headers=H)
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    r = client.get(f'/pix/status/{inv}', headers=_auth(tok))
    assert r.status_code == 200 and r.json()['pago'] is True


def test_pix_webhook_invoice_desconhecida():
    r = client.post('/pix/webhook', json={'pix': [{'txid': 'inexistente-xyz'}]})
    assert r.status_code == 200
    assert r.json()['itens'][0]['known'] is False


def test_pix_webhook_sufixo_pix():
    # a Efi POSTa em .../webhook/pix (acrescenta /pix). A rota precisa existir (200, nao 404).
    r = client.post('/pix/webhook/pix', json={'pix': [{'txid': 'inexistente-xyz'}]})
    assert r.status_code == 200, r.text
    assert r.json()['itens'][0]['known'] is False


# ====================== OCR (Gemini mockado) ======================

def test_ocr_exige_admin():
    tok = _login('player1', 'secret123')['access_token']
    r = client.post('/ocr/resultado', data={'numero_queda': 1},
                    files={'imagem': ('p.png', b'fake', 'image/png')}, headers=_auth(tok))
    assert r.status_code == 403


def test_ocr_resultado(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']

    async def fake_ia(prompt, imagem_b64=None, mime='image/png'):
        assert imagem_b64  # OCR deve enviar a imagem
        return '```json\n[{"nick_detectado": "PLAYER1", "nick_cadastrado": "player1", "colocacao": 2, "abates": 3}]\n```'

    monkeypatch.setattr(main, 'ia_generate', fake_ia)
    r = client.post('/ocr/resultado', data={'numero_queda': 2},
                    files={'imagem': ('p.png', b'fake-image-bytes', 'image/png')},
                    headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    res = r.json()['resultados']
    assert res[0]['jogador_nick'] == 'player1'
    assert res[0]['colocacao'] == 2
    assert res[0]['jogador_id'] is not None


# ====================== SAQUES ======================

def test_saque_fluxo_completo():
    tok = _login('player1', 'secret123')['access_token']
    admin_tok = _login('admin1', 'secret123')['access_token']
    saldo_inicial = client.get('/me', headers=_auth(tok)).json()['saldo']

    # cadastro de dados bancarios invalido -> 400 (endpoint opcional, mantido)
    r = client.put('/me/dados-bancarios', json={'banco_codigo': 'abc', 'agencia': '0001',
        'conta': '12345', 'titular_nome': 'P', 'titular_doc': '12345678901', 'chave_pix': 'x'},
        headers=_auth(tok))
    assert r.status_code == 400

    # cadastro valido
    r = client.put('/me/dados-bancarios', json={'banco_codigo': '260', 'agencia': '0001',
        'conta': '1234567', 'tipo_conta': 'CHECKING', 'titular_nome': 'Player Um',
        'titular_doc': '123.456.789-01', 'chave_pix': '11999990000'}, headers=_auth(tok))
    assert r.status_code == 200, r.text
    r = client.get('/me/dados-bancarios', headers=_auth(tok))
    assert r.json()['completo'] is True
    assert r.json()['banco_codigo'] == '260'

    # valor abaixo do minimo -> 400
    r = client.post('/saques/solicitar', json={'valor': 1.0, 'chave_pix': '11999990000', 'tipo_chave': 'telefone'}, headers=_auth(tok))
    assert r.status_code == 400

    # acima do saldo -> 400
    r = client.post('/saques/solicitar', json={'valor': saldo_inicial + 100, 'chave_pix': '11999990000', 'tipo_chave': 'telefone'}, headers=_auth(tok))
    assert r.status_code == 400

    # tipo de chave invalido -> 400
    r = client.post('/saques/solicitar', json={'valor': 5.0, 'chave_pix': 'x', 'tipo_chave': 'cnpj'}, headers=_auth(tok))
    assert r.status_code == 400

    # solicitacao valida -> debita na hora (reserva)
    r = client.post('/saques/solicitar', json={'valor': 10.0, 'chave_pix': '123.456.789-01', 'tipo_chave': 'cpf'}, headers=_auth(tok))
    assert r.status_code == 200, r.text
    saque_id = r.json()['id']
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_inicial - 10.0

    # segundo saque com um pendente -> 400
    r = client.post('/saques/solicitar', json={'valor': 5.0, 'chave_pix': 'a@b.com', 'tipo_chave': 'email'}, headers=_auth(tok))
    assert r.status_code == 400

    # jogador ve o proprio saque
    r = client.get('/saques/meus', headers=_auth(tok))
    assert r.status_code == 200 and r.json()[0]['status'] == 'pendente'

    # jogador comum nao ve pendentes nem processa
    assert client.get('/saques/pendentes', headers=_auth(tok)).status_code == 403
    assert client.post(f'/saques/{saque_id}/processar', json={'status': 'pago'}, headers=_auth(tok)).status_code == 403

    # admin rejeita -> devolve o valor
    r = client.post(f'/saques/{saque_id}/processar', json={'status': 'rejeitado'}, headers=_auth(admin_tok))
    assert r.status_code == 200
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_inicial

    # novo saque, admin paga -> valor nao volta
    r = client.post('/saques/solicitar', json={'valor': 8.0, 'chave_pix': 'a@b.com', 'tipo_chave': 'email'}, headers=_auth(tok))
    saque2 = r.json()['id']
    r = client.post(f'/saques/{saque2}/processar', json={'status': 'pago'}, headers=_auth(admin_tok))
    assert r.status_code == 200
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_inicial - 8.0

    # reprocessar -> 400
    r = client.post(f'/saques/{saque2}/processar', json={'status': 'rejeitado'}, headers=_auth(admin_tok))
    assert r.status_code == 400



def test_saque_pagar_via_efi(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']
    _set_cpf('admin1', '12345678901')
    _set_saldo('admin1', 100.0)
    r = client.post('/saques/solicitar', json={'valor': 20.0, 'chave_pix': 'admin@x.com', 'tipo_chave': 'email'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    sid = r.json()['id']

    STATUS = {'value': 'EM_PROCESSAMENTO'}

    async def fake_transferir(chave, tipo, valor, code, description=''):
        assert chave == 'admin@x.com' and tipo == 'email' and valor == 20.0
        return {'id': 'idenv-001', 'status': 'EM_PROCESSAMENTO', 'favorecido': {}}

    async def fake_consultar(tid):
        assert tid == 'idenv-001'
        return {'id': tid, 'status': STATUS['value'], 'favorecido': {}}

    monkeypatch.setattr(efi, 'asaas_transferir_pix', fake_transferir)
    monkeypatch.setattr(efi, 'asaas_consultar_transferencia', fake_consultar)

    # EM_PROCESSAMENTO nao e mais tratado como pago
    r = client.post(f'/saques/{sid}/pagar', headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    assert r.json()['transfer_id'] == 'idenv-001'
    assert r.json()['status'] == 'processando'

    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'processando'

    STATUS['value'] = 'REALIZADO'
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'pago'


def test_saque_efi_falha_devolve(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']
    _set_cpf('admin1', '12345678901')
    _set_saldo('admin1', 100.0)
    saldo_antes = client.get('/me', headers=_auth(admin_tok)).json()['saldo']
    r = client.post('/saques/solicitar', json={'valor': 5.0, 'chave_pix': 'admin@x.com', 'tipo_chave': 'email'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    sid = r.json()['id']
    assert client.get('/me', headers=_auth(admin_tok)).json()['saldo'] == saldo_antes - 5.0

    async def fake_transferir(chave, tipo, valor, code, description=''):
        return {'id': 'idenv-002', 'status': 'EM_PROCESSAMENTO', 'favorecido': {}}

    async def fake_consultar(tid):
        return {'id': tid, 'status': 'NAO_REALIZADO', 'favorecido': {}}

    monkeypatch.setattr(efi, 'asaas_transferir_pix', fake_transferir)
    monkeypatch.setattr(efi, 'asaas_consultar_transferencia', fake_consultar)

    client.post(f'/saques/{sid}/pagar', headers=_auth(admin_tok))
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'rejeitado'
    assert client.get('/me', headers=_auth(admin_tok)).json()['saldo'] == saldo_antes


def test_saque_antilavagem_cpf_divergente(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']
    _set_cpf('admin1', '11111111111')
    _set_saldo('admin1', 100.0)
    saldo_antes = client.get('/me', headers=_auth(admin_tok)).json()['saldo']
    r = client.post('/saques/solicitar', json={'valor': 7.0, 'chave_pix': 'outro@x.com', 'tipo_chave': 'email'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    sid = r.json()['id']

    async def fake_transferir(chave, tipo, valor, code, description=''):
        return {'id': 'idenv-003', 'status': 'EM_PROCESSAMENTO', 'favorecido': {}}

    async def fake_consultar(tid):
        # titular real da chave: CPF diverge do dono da conta -> deve bloquear e devolver
        return {'id': tid, 'status': 'REALIZADO',
                'favorecido': {'cpf': '***.999.999-**', 'nome': 'Outra Pessoa'}}

    monkeypatch.setattr(efi, 'asaas_transferir_pix', fake_transferir)
    monkeypatch.setattr(efi, 'asaas_consultar_transferencia', fake_consultar)

    client.post(f'/saques/{sid}/pagar', headers=_auth(admin_tok))
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'rejeitado', r.text
    assert client.get('/me', headers=_auth(admin_tok)).json()['saldo'] == saldo_antes


def test_asaas_rollback_importavel():
    import asaas
    assert hasattr(asaas, 'asaas_transferir_pix')
    assert hasattr(asaas, 'router')
