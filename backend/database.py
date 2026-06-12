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

if IS_SQLITE:
    connect_args['check_same_thread'] = False
else:
    # Supabase exige SSL; pg8000 usa ssl_context
    connect_args['ssl_context'] = ssl.create_default_context()
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
