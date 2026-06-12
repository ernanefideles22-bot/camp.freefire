"""Autenticacao JWT (access + refresh token) com bcrypt."""
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import select

from database import get_db
from models import JogadorModel

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY nao configurada. Defina a variavel de ambiente antes de iniciar.')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 60 * 24))      # 24h
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.environ.get('REFRESH_TOKEN_EXPIRE_MINUTES', 60 * 24 * 30))  # 30d

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
security = HTTPBearer()


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha_plana: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(senha_plana, hashed)
    except Exception:
        return False


def _criar_token(data: dict, minutos: int, tipo: str) -> str:
    to_encode = data.copy()
    to_encode.update({
        'exp': datetime.now(timezone.utc) + timedelta(minutes=minutos),
        'type': tipo,
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def criar_access_token(data: dict) -> str:
    return _criar_token(data, ACCESS_TOKEN_EXPIRE_MINUTES, 'access')


def criar_refresh_token(data: dict) -> str:
    return _criar_token(data, REFRESH_TOKEN_EXPIRE_MINUTES, 'refresh')


def decodificar_token(token: str, tipo_esperado: str = 'access') -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, 'Token invalido ou expirado')
    if payload.get('type', 'access') != tipo_esperado:
        raise HTTPException(401, 'Tipo de token invalido')
    return payload


def obter_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> JogadorModel:
    payload = decodificar_token(credentials.credentials, 'access')
    try:
        user_id = int(payload.get('sub'))
    except (TypeError, ValueError):
        raise HTTPException(401, 'Token invalido ou expirado')
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.id == user_id))
    if not jogador:
        raise HTTPException(401, 'Usuario nao encontrado')
    return jogador


def require_admin(jogador: JogadorModel = Depends(obter_usuario_atual)) -> JogadorModel:
    if not jogador.is_admin:
        raise HTTPException(403, 'Acesso restrito ao administrador.')
    return jogador
