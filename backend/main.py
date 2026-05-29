import os
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from jose import JWTError, jwt
from passlib.context import CryptContext

# ====================== CONFIG JWT ======================
SECRET_KEY = os.environ.get("SECRET_KEY", "chave-secreta-temporaria-mude-depois")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 7 * 24 * 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ====================== DATABASE ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR}/campeonato_freefire.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ====================== MODELOS ======================
class JogadorModel(Base):
    __tablename__ = "jogadores"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    nick = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=False)
    saldo = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

# ====================== HELPERS ======================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_senha(senha: str):
    return pwd_context.hash(senha)

def verificar_senha(senha_plana: str, hashed: str):
    return pwd_context.verify(senha_plana, hashed)

def criar_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def obter_usuario_atual(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        jogador = db.query(JogadorModel).filter(JogadorModel.id == user_id).first()
        if not jogador:
            raise HTTPException(404, "Usuário não encontrado")
        return jogador
    except Exception:
        raise HTTPException(401, "Token inválido ou expirado")

# ====================== SCHEMAS ======================
class JogadorCreate(BaseModel):
    nome: str
    nick: str
    senha: str

class JogadorLogin(BaseModel):
    nick: str
    senha: str

class JogadorResponse(BaseModel):
    id: int
    nome: str
    nick: str
    saldo: float
    is_admin: bool

# ====================== APP ======================
app = FastAPI(title="Campeonato Free Fire")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================== ROTAS ======================
@app.post("/auth/cadastro", response_model=JogadorResponse)
def cadastrar(jogador: JogadorCreate, db: Session = Depends(get_db)):
    if db.query(JogadorModel).filter(JogadorModel.nick == jogador.nick).first():
        raise HTTPException(400, "Nick já existe")
    
    novo = JogadorModel(
        nome=jogador.nome,
        nick=jogador.nick,
        senha_hash=hash_senha(jogador.senha),
        saldo=0.0,
        is_admin = db.query(JogadorModel).count() == 0
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

@app.post("/auth/login")
def login(dados: JogadorLogin, db: Session = Depends(get_db)):
    jogador = db.query(JogadorModel).filter(JogadorModel.nick == dados.nick).first()
    if not jogador or not verificar_senha(dados.senha, jogador.senha_hash):
        raise HTTPException(401, "Nick ou senha incorretos")
    
    token = criar_access_token({"sub": str(jogador.id)})
    return {"access_token": token, "token_type": "bearer", "jogador": jogador}

@app.get("/me")
def me(jogador: JogadorModel = Depends(obter_usuario_atual)):
    return jogador

print("🚀 Backend JWT iniciado!")