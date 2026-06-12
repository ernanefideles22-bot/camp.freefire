"""Configuracao do banco de dados (SQLAlchemy 2.x)."""
import os
import ssl

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get('DATABASE_URL', f'sqlite:///{BASE_DIR}/campeonato_freefire.db')

# Normaliza URL do Postgres para o driver pg8000
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+pg8000://', 1)
elif DATABASE_URL.startswith('postgresql://') and '+pg8000' not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+pg8000://', 1)

IS_SQLITE = DATABASE_URL.startswith('sqlite')
IS_SERVERLESS = bool(os.environ.get('VERCEL'))

connect_args: dict = {}
engine_kwargs: dict = {}

def _criar_ssl_context() -> ssl.SSLContext:
    """SSL para o Postgres do Supabase.

    O pooler (Supavisor) usa certificado assinado pela CA propria do Supabase.
    - Se SUPABASE_CA_B64 estiver definida (cert do painel em base64), valida a cadeia.
    - Caso contrario, conexao TLS criptografada sem validacao de CA (necessario
      porque a CA do Supabase nao esta no bundle padrao do sistema).
    """
    ca_b64 = os.environ.get('SUPABASE_CA_B64', '')
    if ca_b64:
        import base64
        ctx = ssl.create_default_context(cadata=base64.b64decode(ca_b64).decode('utf-8'))
        ctx.check_hostname = True
        return ctx
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


if IS_SQLITE:
    connect_args['check_same_thread'] = False
else:
    # Supabase exige SSL; pg8000 usa ssl_context
    connect_args['ssl_context'] = _criar_ssl_context()
    if IS_SERVERLESS:
        # Em serverless, nao manter pool entre invocacoes
        engine_kwargs['poolclass'] = NullPool
    else:
        engine_kwargs['pool_pre_ping'] = True

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
