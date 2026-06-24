"""Testes isolados do adapter efi.py (sem rede; _api mockado).

Provam, em especial, os dois fixes pos-doc oficial:
  (1) consulta de envio usa GET /v2/gn/pix/enviados/id-envio/{idEnvio};
  (2) o titular vem achatado de favorecido.identificacao.{cpf,nome}.
"""
import os
import sys
import asyncio
import tempfile

os.environ.setdefault('SECRET_KEY', 'test-secret')
_dbfile = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
os.environ.setdefault('DATABASE_URL', f'sqlite:///{_dbfile.name}')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi import HTTPException
import efi


def test_status_sets():
    assert 'REALIZADO' in efi.TRANSFER_DONE
    assert 'EM_PROCESSAMENTO' not in efi.TRANSFER_DONE   # fix: nao e mais "pago"
    assert 'NAO_REALIZADO' in efi.TRANSFER_FAIL
    assert 'CONCLUIDA' in efi.PAID_STATUSES


def test_webhook_aceita_sufixo_pix():
    paths = [r.path for r in efi.router.routes]
    assert any(p.endswith('/webhook') for p in paths)
    assert any(p.endswith('/webhook/pix') for p in paths)   # Efi acrescenta /pix


def test_consultar_transferencia_path_e_flatten(monkeypatch):
    cap = {}

    async def fake_api(method, path, json=None):
        cap['method'], cap['path'] = method, path
        return {
            'idEnvio': 'idenv-x', 'status': 'REALIZADO', 'endToEndId': 'E123',
            'favorecido': {
                'chave': 'k@x.com',
                'identificacao': {'nome': 'Fulano da Silva', 'cpf': '***.456.789-**'},
                'contaBanco': {'codigoBanco': '001'},
            },
        }

    monkeypatch.setattr(efi, '_api', fake_api)
    out = asyncio.run(efi.asaas_consultar_transferencia('idenv-x'))
    # FIX 1: path de consulta por idEnvio
    assert cap['path'] == '/v2/gn/pix/enviados/id-envio/idenv-x'
    # FIX 2: titular achatado p/ a trava antilavagem do main.py
    assert out['favorecido']['cpf'] == '***.456.789-**'
    assert out['favorecido']['nome'] == 'Fulano da Silva'
    assert out['status'] == 'REALIZADO'


def test_consultar_chave_formatos():
    assert asyncio.run(efi.asaas_consultar_chave('cpf', '123.456.789-01'))['chave']
    asyncio.run(efi.asaas_consultar_chave('email', 'a@b.com'))
    asyncio.run(efi.asaas_consultar_chave('telefone', '+5511999990000'))
    asyncio.run(efi.asaas_consultar_chave('aleatoria', '12345678-1234-1234-1234-123456789012'))
    for tipo, chave in [('cpf', 'abc'), ('email', 'semarroba'), ('telefone', '12'), ('aleatoria', 'curta')]:
        with pytest.raises(HTTPException):
            asyncio.run(efi.asaas_consultar_chave(tipo, chave))


def test_id_envio_e_txid_formato():
    ide = efi._id_envio('SAQ-12')
    assert ide.isalnum() and len(ide) <= 35
    txid = efi._txid_novo(7)
    assert txid.isalnum() and 26 <= len(txid) <= 35
