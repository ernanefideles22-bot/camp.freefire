"""Testes das rotas criticas: auth, inscricao, PIX, OCR."""
import os
import sys

os.environ['SECRET_KEY'] = 'test-secret'
os.environ['DATABASE_URL'] = 'sqlite://'  # em memoria... sqlite:// nao persiste entre conexoes
# usamos arquivo temporario para compartilhar entre sessoes
import tempfile
_dbfile = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
os.environ['DATABASE_URL'] = f'sqlite:///{_dbfile.name}'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient

import main
import models
import asaas
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


# ====================== AUTH ======================

def test_cadastro_primeiro_usuario_e_admin():
    r = client.post('/auth/cadastro', json={'nome': 'Admin', 'nick': 'admin1', 'senha': 'secret123'})
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
    client.post('/auth/cadastro', json={'nome': 'Player', 'nick': 'player1', 'senha': 'secret123'})
    tok = _login('player1', 'secret123')['access_token']
    admin_tok = _login('admin1', 'secret123')['access_token']

    # sem saldo -> 400
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 400

    # admin aprova um deposito manual de R$ 10
    r = client.post('/depositos/solicitar', json={'valor': 10.0}, headers=_auth(tok))
    assert r.status_code == 200, r.text
    dep_id = r.json()['id']
    r = client.post(f'/depositos/{dep_id}/processar', json={'status': 'aprovado'}, headers=_auth(admin_tok))
    assert r.status_code == 200

    # jogador comum nao pode aprovar deposito
    r = client.post('/depositos/solicitar', json={'valor': 5.0}, headers=_auth(tok))
    dep2 = r.json()['id']
    r = client.post(f'/depositos/{dep2}/processar', json={'status': 'aprovado'}, headers=_auth(tok))
    assert r.status_code == 403

    # com saldo -> inscreve
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 200
    # inscricao duplicada -> 400
    r = client.post('/queda/1/inscrever', headers=_auth(tok))
    assert r.status_code == 400

    # saldo debitado (10 - 2 = 8)
    me = client.get('/me', headers=_auth(tok)).json()
    assert me['saldo'] == 8.0

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
    assert item['total_premios'] == 22.0
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

    FAKE_STATUS = {'value': 'PENDING'}

    async def fake_api(method, path, json=None):
        if path == '/customers' and method == 'POST':
            return {'id': 'cus-001'}
        if path == '/payments' and method == 'POST':
            assert json['billingType'] == 'PIX'
            assert json['value'] == 15.0
            return {'id': 'pay-123', 'status': 'PENDING'}
        if path == '/payments/pay-123/pixQrCode':
            return {'payload': '000201qrcode-emv', 'encodedImage': 'img64', 'expirationDate': '2026-12-31'}
        if path == '/payments/pay-123':
            return {'id': 'pay-123', 'status': FAKE_STATUS['value']}
        raise AssertionError(f'chamada inesperada: {method} {path}')

    monkeypatch.setattr(asaas, '_api', fake_api)
    monkeypatch.setattr(asaas, 'ASAAS_WEBHOOK_TOKEN', 'tok-webhook')

    # cria cobranca de R$ 15
    r = client.post('/pix/criar-cobranca', json={'valor': 15.0, 'cpf': '123.456.789-01'},
                    headers=_auth(tok))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['invoice_id'] == 'pay-123'
    assert data['qr_code'] == '000201qrcode-emv'

    saldo_antes = client.get('/me', headers=_auth(tok)).json()['saldo']

    # webhook sem token correto -> 401
    r = client.post('/pix/webhook', json={'event': 'PAYMENT_RECEIVED', 'payment': {'id': 'pay-123'}})
    assert r.status_code == 401

    # webhook com token mas Asaas ainda diz PENDING -> NAO credita
    H_wh = {'asaas-access-token': 'tok-webhook'}
    r = client.post('/pix/webhook', json={'event': 'PAYMENT_RECEIVED', 'payment': {'id': 'pay-123'}}, headers=H_wh)
    assert r.status_code == 200
    assert r.json()['creditado'] is False
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes

    # Asaas confirma RECEIVED -> credita
    FAKE_STATUS['value'] = 'RECEIVED'
    r = client.post('/pix/webhook', json={'payment': {'id': 'pay-123'}}, headers=H_wh)
    assert r.json()['creditado'] is True
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    # idempotencia
    r = client.post('/pix/webhook', json={'payment': {'id': 'pay-123'}}, headers=H_wh)
    assert r.json()['creditado'] is False
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    # polling
    r = client.get('/pix/status/pay-123', headers=_auth(tok))
    assert r.status_code == 200
    assert r.json()['pago'] is True


def test_pix_webhook_invoice_desconhecida():
    r = client.post('/pix/webhook', json={'payment': {'id': 'inv-inexistente'}})
    assert r.status_code == 200
    assert r.json()['known'] is False


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



def test_saque_pagar_via_asaas(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']
    # da saldo ao admin via deposito manual
    r = client.post('/depositos/solicitar', json={'valor': 30.0}, headers=_auth(admin_tok))
    client.post(f"/depositos/{r.json()['id']}/processar", json={'status': 'aprovado'}, headers=_auth(admin_tok))
    r = client.post('/saques/solicitar', json={'valor': 20.0, 'chave_pix': 'admin@x.com', 'tipo_chave': 'email'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    sid = r.json()['id']

    TRANSFER_STATUS = {'value': 'PENDING'}

    async def fake_transferir(chave, tipo, valor, code, description=''):
        assert chave == 'admin@x.com'
        assert tipo == 'email'
        assert valor == 20.0
        return {'id': 'tra-001', 'status': 'PENDING'}

    async def fake_consultar(tid):
        assert tid == 'tra-001'
        return {'id': tid, 'status': TRANSFER_STATUS['value']}

    monkeypatch.setattr(asaas, 'asaas_transferir_pix', fake_transferir)
    monkeypatch.setattr(asaas, 'asaas_consultar_transferencia', fake_consultar)

    r = client.post(f'/saques/{sid}/pagar', headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    assert r.json()['transfer_id'] == 'tra-001'
    assert r.json()['status'] == 'processando'

    # ainda processando
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'processando'

    # concluida -> pago
    TRANSFER_STATUS['value'] = 'DONE'
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'pago'


def test_saque_asaas_falha_devolve(monkeypatch):
    admin_tok = _login('admin1', 'secret123')['access_token']
    saldo_antes = client.get('/me', headers=_auth(admin_tok)).json()['saldo']
    r = client.post('/saques/solicitar', json={'valor': 5.0, 'chave_pix': 'admin@x.com', 'tipo_chave': 'email'}, headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    sid = r.json()['id']

    async def fake_transferir(chave, tipo, valor, code, description=''):
        return {'id': 'tra-002', 'status': 'PENDING'}

    async def fake_consultar(tid):
        return {'id': tid, 'status': 'FAILED'}

    monkeypatch.setattr(asaas, 'asaas_transferir_pix', fake_transferir)
    monkeypatch.setattr(asaas, 'asaas_consultar_transferencia', fake_consultar)

    client.post(f'/saques/{sid}/pagar', headers=_auth(admin_tok))
    r = client.post(f'/saques/{sid}/conferir', headers=_auth(admin_tok))
    assert r.json()['status'] == 'rejeitado'
    assert client.get('/me', headers=_auth(admin_tok)).json()['saldo'] == saldo_antes
