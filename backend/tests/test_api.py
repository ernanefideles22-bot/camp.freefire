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
import cora_pix
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

    async def fake_token():
        return 'tkn-fake'

    class FakeResp:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = str(payload)
        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, **k):
            return FakeResp(201, {'id': 'inv-123', 'status': 'OPEN',
                                  'pix': {'emv': '000201qrcode-emv'}})
        async def get(self, url, **k):
            return FakeResp(200, {'id': 'inv-123', 'status': FAKE_CORA_STATUS['value'],
                                  'amount': 1500})

    FAKE_CORA_STATUS = {'value': 'OPEN'}
    monkeypatch.setattr(cora_pix, 'get_cora_token', fake_token)
    monkeypatch.setattr(cora_pix, '_get_cert_files', lambda: ('/dev/null', '/dev/null'))
    monkeypatch.setattr(cora_pix.httpx, 'AsyncClient', FakeClient)

    # cria cobranca de R$ 15
    r = client.post('/pix/criar-cobranca', json={'valor': 15.0, 'cpf': '12345678901'},
                    headers=_auth(tok))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['invoice_id'] == 'inv-123'
    assert data['qr_code'] == '000201qrcode-emv'

    saldo_antes = client.get('/me', headers=_auth(tok)).json()['saldo']

    # webhook chega mas a Cora ainda diz OPEN -> NAO credita (payload nao e confiavel)
    r = client.post('/pix/webhook', json={'id': 'inv-123', 'status': 'PAID'})
    assert r.status_code == 200
    assert r.json()['creditado'] is False
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes

    # agora a Cora confirma PAID -> credita
    FAKE_CORA_STATUS['value'] = 'PAID'
    r = client.post('/pix/webhook', json={'id': 'inv-123'})
    assert r.json()['creditado'] is True
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    # idempotencia: reenvio do webhook nao credita de novo
    r = client.post('/pix/webhook', json={'id': 'inv-123'})
    assert r.json()['creditado'] is False
    assert client.get('/me', headers=_auth(tok)).json()['saldo'] == saldo_antes + 15.0

    # status/polling
    r = client.get('/pix/status/inv-123', headers=_auth(tok))
    assert r.status_code == 200
    assert r.json()['pago'] is True


def test_pix_webhook_invoice_desconhecida():
    r = client.post('/pix/webhook', json={'id': 'inv-inexistente', 'status': 'PAID'})
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

    async def fake_gemini(parts):
        return '```json\n[{"nick_detectado": "PLAYER1", "nick_cadastrado": "player1", "colocacao": 2, "abates": 3}]\n```'

    monkeypatch.setattr(main, 'gemini_generate', fake_gemini)
    r = client.post('/ocr/resultado', data={'numero_queda': 2},
                    files={'imagem': ('p.png', b'fake-image-bytes', 'image/png')},
                    headers=_auth(admin_tok))
    assert r.status_code == 200, r.text
    res = r.json()['resultados']
    assert res[0]['jogador_nick'] == 'player1'
    assert res[0]['colocacao'] == 2
    assert res[0]['jogador_id'] is not None
