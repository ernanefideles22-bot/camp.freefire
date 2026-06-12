"""Adaptador serverless do Vercel: expoe o backend FastAPI sob /api.

Se a inicializacao falhar (ex.: variavel de ambiente faltando), expoe o motivo
em /api/* como JSON 503 em vez de um FUNCTION_INVOCATION_FAILED opaco.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from fastapi import FastAPI

app = FastAPI()

try:
    from main import app as backend_app
    app.mount('/api', backend_app)
except Exception as exc:  # noqa: BLE001
    _erro = f'{type(exc).__name__}: {exc}'

    @app.get('/api/{path:path}')
    @app.post('/api/{path:path}')
    def _falha_inicializacao(path: str):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={
            'detail': 'Backend nao inicializou. Verifique as variaveis de ambiente no Vercel.',
            'erro': _erro,
        })
