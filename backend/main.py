import os
import hashlib
import json
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, Header, UploadFile, File, Depends
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# CARREGAMENTO DAS VARIÃÂÃÂVEIS DE AMBIENTE (.env)
# ==========================================
def carregar_env():
    for caminho in [".env", "backend/.env", "../.env", "../../.env"]:
        if os.path.exists(caminho):
            try:
                with open(caminho, "r", encoding="utf-8") as f:
                    for linha in f:
                        linha = linha.strip()
                        if linha and not linha.startswith("#") and "=" in linha:
                            chave, valor = linha.split("=", 1)
                            os.environ[chave.strip()] = valor.strip().strip('"').strip("'")
            except Exception:
                pass

carregar_env()

# Unificar caminho do SQLite usando caminho absoluto relativo ao diretÃÂÃÂ³rio deste script
import os
from cora_pix import router as pix_router
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "campeonato_freefire.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{db_path}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if "postgresql" in DATABASE_URL:
    engine = create_engine(DATABASE_URL)
else:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==========================================
# MODELOS DO BANCO DE DADOS
# ==========================================
class JogadorModel(Base):
    __tablename__ = "jogadores"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    nick = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=False)
    saldo = Column(Float, default=0.0, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

class DepositoRequisicaoModel(Base):
    __tablename__ = "deposito_requisicoes"
    id = Column(Integer, primary_key=True, index=True)
    jogador_id = Column(Integer, ForeignKey("jogadores.id"), nullable=False)
    valor = Column(Float, nullable=False)
    data_hora = Column(String, nullable=False)
    status = Column(String, default="pendente", nullable=False) # 'pendente', 'aprovado', 'rejeitado'

class InscricaoQuedaModel(Base):
    __tablename__ = "inscricao_quedas"
    id = Column(Integer, primary_key=True, index=True)
    numero_queda = Column(Integer, nullable=False)
    jogador_id = Column(Integer, ForeignKey("jogadores.id"), nullable=False)
    pago = Column(Boolean, default=True, nullable=False)
    data_hora = Column(String, nullable=False)

class InfoSalaModel(Base):
    __tablename__ = "info_salas"
    id = Column(Integer, primary_key=True, index=True)
    numero_queda = Column(Integer, unique=True, nullable=False)
    sala_id = Column(String, nullable=False)  # ID numÃÂÃÂ©rico gerado pelo Free Fire
    senha = Column(String, nullable=False)

class QuedaModel(Base):
    __tablename__ = "pontuacoes_quedas"
    id = Column(Integer, primary_key=True, index=True)
    numero_queda = Column(Integer, nullable=False)
    jogador_id = Column(Integer, ForeignKey("jogadores.id"), nullable=False)
    colocacao = Column(Integer, nullable=False)
    abates = Column(Integer, default=0, nullable=False)

Base.metadata.create_all(bind=engine)

def executar_migracoes():
    try:
        with engine.begin() as connection:
            result = connection.execute("PRAGMA table_info(jogadores)").fetchall()
            colunas = [row[1] for row in result]
            
            # Adiciona senha_hash se nÃÂÃÂ£o existir
            if "senha_hash" not in colunas:
                print("MigraÃÂÃÂ§ÃÂÃÂ£o: Adicionando coluna 'senha_hash' ÃÂÃÂ  tabela 'jogadores'.")
                connection.execute("ALTER TABLE jogadores ADD COLUMN senha_hash VARCHAR DEFAULT ''")
                default_hash = hashlib.sha256("1234".encode("utf-8")).hexdigest()
                connection.execute(f"UPDATE jogadores SET senha_hash = '{default_hash}'")
                
            # Adiciona saldo se nÃÂÃÂ£o existir
            if "saldo" not in colunas:
                print("MigraÃÂÃÂ§ÃÂÃÂ£o: Adicionando coluna 'saldo' ÃÂÃÂ  tabela 'jogadores'.")
                connection.execute("ALTER TABLE jogadores ADD COLUMN saldo FLOAT DEFAULT 0.0")
                
            # Adiciona is_admin se nÃÂÃÂ£o existir
            if "is_admin" not in colunas:
                print("MigraÃÂÃÂ§ÃÂÃÂ£o: Adicionando coluna 'is_admin' ÃÂÃÂ  tabela 'jogadores'.")
                connection.execute("ALTER TABLE jogadores ADD COLUMN is_admin BOOLEAN DEFAULT 0")
                connection.execute("UPDATE jogadores SET is_admin = 1 WHERE LOWER(nick) = 'admin'")
                
            print("MigraÃÂÃÂ§ÃÂÃÂµes do banco de dados verificadas e executadas com sucesso.")
    except Exception as e:
        print(f"Erro crÃÂÃÂ­tico durante migraÃÂÃÂ§ÃÂÃÂ£o do banco de dados: {e}")

executar_migracoes()

def seed_admin():
    import hashlib
    from sqlalchemy.orm import sessionmaker as _sm
    _db = _sm(autocommit=False, autoflush=False, bind=engine)()
    try:
        _adm = _db.query(JogadorModel).filter(JogadorModel.nick == 'admin').first()
        if not _adm:
            _h = hashlib.sha256('Admin@2025'.encode('utf-8')).hexdigest()
            _adm = JogadorModel(nome='Administrador', nick='admin', senha_hash=_h, saldo=0.0, is_admin=True)
            _db.add(_adm)
            _db.commit()
            print('[SEED] Admin criado: nick=admin senha=Admin@2025')
        elif not _adm.is_admin:
            _adm.is_admin = True
            _db.commit()
            print('[SEED] is_admin=True setado para admin')
    finally:
        _db.close()

seed_admin()


# ==========================================
# SCHEMAS DE VALIDAÃÂÃÂÃÂÃÂO (PYDANTIC)
# ==========================================
class JogadorCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=50)
    nick: str = Field(..., min_length=3, max_length=20)
    senha: str = Field(..., min_length=4, max_length=30)

class JogadorLogin(BaseModel):
    nick: str
    senha: str

class JogadorResponse(BaseModel):
    id: int
    nome: str
    nick: str
    saldo: float
    is_admin: bool
    class Config:
        from_attributes = True

class DepositoRequest(BaseModel):
    valor: float = Field(..., ge=2.0)

class DepositoResponse(BaseModel):
    id: int
    jogador_id: int
    valor: float
    data_hora: str
    status: str
    class Config:
        from_attributes = True

class DepositoResponseDetailed(BaseModel):
    id: int
    jogador_id: int
    jogador_nick: str
    valor: float
    data_hora: str
    status: str

class ProcessarDepositoInput(BaseModel):
    status: str  # 'aprovado' ou 'rejeitado'

class StatusQuedaResponse(BaseModel):
    numero_queda: int
    inscritos_count: int
    limite: int = 48
    esta_inscrito: bool
    sala_liberada: bool

class CriarSalaInput(BaseModel):
    numero_queda: int = Field(..., ge=1)
    sala_id: str = Field(..., min_length=4, description="ID da sala personalizada do Free Fire")
    senha: str = Field(..., min_length=1)

class SalaResponse(BaseModel):
    numero_queda: int
    sala_id: str
    senha: str
    class Config:
        from_attributes = True

class ResultadoQuedaInput(BaseModel):
    jogador_id: int
    colocacao: int = Field(..., ge=1, le=52)
    abates: int = Field(..., ge=0)

class RegistroQuedaBatch(BaseModel):
    numero_queda: int = Field(..., ge=1)
    resultados: List[ResultadoQuedaInput]

class ClassificacaoGeralResponse(BaseModel):
    posicao: int
    jogador_id: int
    nick: str
    total_pontos: int
    total_abates: int
    quedas_jogadas: int
    ganhos_reais: float

# ==========================================
# MOTOR DE PONTUAÃÂÃÂÃÂÃÂO
# ==========================================
TABELA_PONTUACAO_COLOCACAO = {
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1
}

def calcular_pontos(colocacao: int, abates: int) -> int:
    return TABELA_PONTUACAO_COLOCACAO.get(colocacao, 0) + abates

app = FastAPI(title="Campeonato Free Fire Solo API", version="1.1.0")

# ==========================================
# CONFIGURAÃÂÃÂÃÂÃÂO DO MIDDLEWARE CORS
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(pix_router)

# ==========================================
# FUNÃÂÃÂÃÂÃÂES AUXILIARES / UTILITÃÂÃÂRIAS
# ==========================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode("utf-8")).hexdigest()

def obter_usuario_atual(db, x_user_id: Optional[str] = Header(None)) -> JogadorModel:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="UsuÃÂÃÂ¡rio nÃÂÃÂ£o autenticado (x-user-id ausente)."
        )
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID de usuÃÂÃÂ¡rio invÃÂÃÂ¡lido."
        )
    jogador = db.query(JogadorModel).filter(JogadorModel.id == user_id).first()
    if not jogador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="UsuÃÂÃÂ¡rio nÃÂÃÂ£o encontrado."
        )
    return jogador

# ROTAS DE JOGADORES E AUTENTICAÃÂÃÂÃÂÃÂO
@app.post("/auth/cadastro", response_model=JogadorResponse, status_code=201)
def cadastrar_usuario(jogador: JogadorCreate, db: Session = Depends(get_db)):
    db_jogador = db.query(JogadorModel).filter(JogadorModel.nick == jogador.nick).first()
    if db_jogador:
        raise HTTPException(status_code=400, detail="Este Nick jÃÂÃÂ¡ estÃÂÃÂ¡ cadastrado.")
    
    # Se for o primeiro cadastro ou o nick for "admin", torna admin
    num_jogadores = db.query(JogadorModel).count()
    is_admin = False
    if num_jogadores == 0 or jogador.nick.lower() == "admin":
        is_admin = True
        
    novo_jogador = JogadorModel(
        nome=jogador.nome,
        nick=jogador.nick,
        senha_hash=hash_senha(jogador.senha),
        saldo=0.0,
        is_admin=is_admin
    )
    db.add(novo_jogador)
    db.commit()
    db.refresh(novo_jogador)
    return novo_jogador

@app.post("/auth/login", response_model=JogadorResponse)
def login_usuario(dados: JogadorLogin, db: Session = Depends(get_db)):
    jogador = db.query(JogadorModel).filter(JogadorModel.nick == dados.nick).first()
    if not jogador or jogador.senha_hash != hash_senha(dados.senha):
        raise HTTPException(status_code=401, detail="Nick ou senha incorretos.")
    return jogador

# Rota antiga para compatibilidade
@app.post("/jogadores", response_model=JogadorResponse, status_code=201)
def cadastrar_jogador(jogador: JogadorCreate, db: Session = Depends(get_db)):
    return cadastrar_usuario(jogador, db)

@app.get("/jogadores", response_model=List[JogadorResponse])
def listar_jogadores(db: Session = Depends(get_db)):
    jogadores = db.query(JogadorModel).all()
    return jogadores

# ROTAS DE CARTEIRA / DEPÃÂÃÂSITOS
@app.post("/carteira/depositar", response_model=DepositoResponse, status_code=201)
def solicitar_deposito(dados: DepositoRequest, x_user_id: str = Header(...), db: Session = Depends(get_db)):
    jogador = obter_usuario_atual(db, x_user_id)
    
    nova_requisicao = DepositoRequisicaoModel(
        jogador_id=jogador.id,
        valor=dados.valor,
        data_hora=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status="pendente"
    )
    db.add(nova_requisicao)
    db.commit()
    db.refresh(nova_requisicao)
    return nova_requisicao

@app.get("/admin/depositos/pendentes", response_model=List[DepositoResponseDetailed])
def listar_depositos_pendentes(x_user_id: str = Header(...), db: Session = Depends(get_db)):
    admin = obter_usuario_atual(db, x_user_id)
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
        
    requisicoes = db.query(DepositoRequisicaoModel).filter(DepositoRequisicaoModel.status == "pendente").all()
    
    resposta = []
    for req in requisicoes:
        jogador = db.query(JogadorModel).filter(JogadorModel.id == req.jogador_id).first()
        resposta.append(DepositoResponseDetailed(
            id=req.id,
            jogador_id=req.jogador_id,
            jogador_nick=jogador.nick if jogador else "Desconhecido",
            valor=req.valor,
            data_hora=req.data_hora,
            status=req.status
        ))
    return resposta

@app.post("/admin/depositos/{id}/processar")
def processar_deposito(id: int, dados: ProcessarDepositoInput, x_user_id: str = Header(...), db: Session = Depends(get_db)):
    admin = obter_usuario_atual(db, x_user_id)
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
        
    req = db.query(DepositoRequisicaoModel).filter(DepositoRequisicaoModel.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="RequisiÃÂÃÂ§ÃÂÃÂ£o de depÃÂÃÂ³sito nÃÂÃÂ£o encontrada.")
        
    if req.status != "pendente":
        raise HTTPException(status_code=400, detail="Esta requisiÃÂÃÂ§ÃÂÃÂ£o jÃÂÃÂ¡ foi processada.")
        
    if dados.status not in ["aprovado", "rejeitado"]:
        raise HTTPException(status_code=400, detail="Status invÃÂÃÂ¡lido. Use 'aprovado' ou 'rejeitado'.")
        
    req.status = dados.status
    if dados.status == "aprovado":
        jogador = db.query(JogadorModel).filter(JogadorModel.id == req.jogador_id).first()
        if jogador:
            jogador.saldo += req.valor
            
    db.commit()
    return {"message": f"DepÃÂÃÂ³sito {id} processado com status: {dados.status}."}

# ROTAS ADMIN - JOGADORES
@app.delete('/admin/jogadores/{jogador_id}')
def deletar_jogador(jogador_id: int, x_user_id: str = Header(...), db: Session = Depends(get_db)):
    admin = obter_usuario_atual(db, x_user_id)
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail='Acesso negado.')
    jogador = db.query(JogadorModel).filter(JogadorModel.id == jogador_id).first()
    if not jogador:
        raise HTTPException(status_code=404, detail='Jogador nao encontrado.')
    if jogador.id == admin.id:
        raise HTTPException(status_code=400, detail='Nao e possivel deletar a si mesmo.')
    db.delete(jogador)
    db.commit()
    return {'message': f'Jogador {jogador_id} deletado com sucesso.'}


# ROTAS DE INSCRIÃÂÃÂÃÂÃÂES
@app.post("/quedas/{numero_queda}/inscrever")
def inscrever_queda(numero_queda: int, x_user_id: str = Header(...), db: Session = Depends(get_db)):
    jogador = obter_usuario_atual(db, x_user_id)
    
    # 1. Verificar se jÃÂÃÂ¡ estÃÂÃÂ¡ inscrito
    inscricao_existente = db.query(InscricaoQuedaModel).filter(
        InscricaoQuedaModel.numero_queda == numero_queda,
        InscricaoQuedaModel.jogador_id == jogador.id
    ).first()
    
    if inscricao_existente:
        return {"message": "Jogador jÃÂÃÂ¡ estÃÂÃÂ¡ inscrito nesta queda.", "inscrito": True}
        
    # 2. Verificar limite de 48 jogadores
    count_inscritos = db.query(InscricaoQuedaModel).filter(
        InscricaoQuedaModel.numero_queda == numero_queda
    ).count()
    if count_inscritos >= 48:
        raise HTTPException(status_code=400, detail="Esta queda jÃÂÃÂ¡ atingiu o limite de 48 jogadores.")
        
    # 3. Verificar saldo (R$ 2,00)
    if jogador.saldo < 2.0:
        raise HTTPException(status_code=400, detail="Saldo insuficiente. VocÃÂÃÂª precisa de no mÃÂÃÂ­nimo R$ 2,00 para se inscrever.")
        
    # 4. Debitar saldo
    jogador.saldo -= 2.0
    
    # 5. Criar inscriÃÂÃÂ§ÃÂÃÂ£o
    nova_inscricao = InscricaoQuedaModel(
        numero_queda=numero_queda,
        jogador_id=jogador.id,
        pago=True,
        data_hora=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )
    db.add(nova_inscricao)
    db.commit()
    
    # Obter contagem atualizada
    count_inscritos = db.query(InscricaoQuedaModel).filter(
        InscricaoQuedaModel.numero_queda == numero_queda
    ).count()
    
    return {
        "message": "InscriÃÂÃÂ§ÃÂÃÂ£o realizada com sucesso!",
        "inscrito": True,
        "inscritos_count": count_inscritos
    }

@app.get("/quedas/{numero_queda}/status", response_model=StatusQuedaResponse)
def obter_status_queda(numero_queda: int, x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    # 1. Contar inscritos
    count_inscritos = db.query(InscricaoQuedaModel).filter(
        InscricaoQuedaModel.numero_queda == numero_queda
    ).count()
    
    # 2. Verificar se o jogador logado estÃÂÃÂ¡ inscrito
    esta_inscrito = False
    if x_user_id:
        try:
            user_id = int(x_user_id)
            inscricao = db.query(InscricaoQuedaModel).filter(
                InscricaoQuedaModel.numero_queda == numero_queda,
                InscricaoQuedaModel.jogador_id == user_id
            ).first()
            if inscricao:
                esta_inscrito = True
        except ValueError:
            pass
            
    # 3. Verificar se dados de sala estÃÂÃÂ£o liberados
    sala = db.query(InfoSalaModel).filter(InfoSalaModel.numero_queda == numero_queda).first()
    sala_liberada = sala is not None
    
    return StatusQuedaResponse(
        numero_queda=numero_queda,
        inscritos_count=count_inscritos,
        esta_inscrito=esta_inscrito,
        sala_liberada=sala_liberada
    )

@app.post("/quedas/{numero_queda}/cancelar-reembolsar")
def cancelar_reembolsar_queda(numero_queda: int, x_user_id: str = Header(...), db: Session = Depends(get_db)):
    admin = obter_usuario_atual(db, x_user_id)
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
        
    # Buscar todos os jogadores inscritos nesta queda
    inscricoes = db.query(InscricaoQuedaModel).filter(
        InscricaoQuedaModel.numero_queda == numero_queda
    ).all()
    
    reembolsados = 0
    for insc in inscricoes:
        if insc.pago:
            jogador = db.query(JogadorModel).filter(JogadorModel.id == insc.jogador_id).first()
            if jogador:
                jogador.saldo += 2.0
                reembolsados += 1
        db.delete(insc)
        
    # TambÃÂÃÂ©m apagar dados de sala se existirem
    db.query(InfoSalaModel).filter(InfoSalaModel.numero_queda == numero_queda).delete()
    
    db.commit()
    return {"message": f"Queda {numero_queda} cancelada. {reembolsados} jogadores foram reembolsados em R$ 2,00."}

# ROTAS DE PROCESSAMENTO OCR COM GEMINI
@app.post("/quedas/{numero_queda}/processar-ocr")
async def processar_ocr_queda(numero_queda: int, file: UploadFile = File(...), x_user_id: str = Header(...), db: Session = Depends(get_db)):
    admin = obter_usuario_atual(db, x_user_id)
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
        
    # Verificar API KEY do Gemini
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Chave de API do Gemini nÃÂÃÂ£o configurada no backend.")
        
    # Ler imagem
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        # Preparar a imagem para o Gemini
        image_part = {
            "mime_type": file.content_type or "image/png",
            "data": contents
        }
        
        # InstruÃÂÃÂ§ÃÂÃÂ£o para leitura do placar do Free Fire
        prompt = (
            "Analise este print do placar final de uma partida de Free Fire (Modo Solo).\n"
            "Identifique todos os jogadores listados na imagem.\n"
            "Para cada jogador identificado, extraia:\n"
            "- jogador_nick (o nickname visÃÂÃÂ­vel no placar)\n"
            "- colocacao (a posiÃÂÃÂ§ÃÂÃÂ£o final dele, um nÃÂÃÂºmero inteiro de 1 a 52)\n"
            "- abates (a quantidade de kills/eliminaÃÂÃÂ§ÃÂÃÂµes, nÃÂÃÂºmero inteiro de 0 a 50)\n\n"
            "VocÃÂÃÂª deve responder APENAS com um array JSON vÃÂÃÂ¡lido, contendo objetos com os campos 'jogador_nick', 'colocacao' e 'abates'.\n"
            "NÃÂÃÂ£o adicione nenhuma explicaÃÂÃÂ§ÃÂÃÂ£o, markdown ou caracteres extras fora do JSON.\n"
            "Exemplo de saÃÂÃÂ­da:\n"
            '[{"jogador_nick": "loko01", "colocacao": 1, "abates": 5}, {"jogador_nick": "Baiano", "colocacao": 2, "abates": 1}]'
        )
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([image_part, prompt])
        
        response_text = response.text.strip()
        if response_text.startswith("```"):
            linhas_texto = response_text.split("\n")
            if linhas_texto[0].startswith("```"):
                linhas_texto = linhas_texto[1:]
            if linhas_texto[-1].startswith("```"):
                linhas_texto = linhas_texto[:-1]
            response_text = "\n".join(linhas_texto).strip()
            
        dados_ocr = json.loads(response_text)
        
        jogadores_cadastrados = db.query(JogadorModel).all()
        nick_to_id = {j.nick.lower().strip(): j.id for j in jogadores_cadastrados}
        nick_to_original_nick = {j.nick.lower().strip(): j.nick for j in jogadores_cadastrados}
        
        resultados_enriquecidos = []
        for item in dados_ocr:
            nick_detectado = item.get("jogador_nick", "").strip()
            colocacao = item.get("colocacao", 0)
            abates = item.get("abates", 0)
            
            nick_key = nick_detectado.lower()
            jogador_id = nick_to_id.get(nick_key, None)
            nick_final = nick_to_original_nick.get(nick_key, nick_detectado)
            
            resultados_enriquecidos.append({
                "jogador_id": jogador_id,
                "jogador_nick": nick_final,
                "colocacao": colocacao,
                "abates": abates
            })
            
        return {
            "numero_queda": numero_queda,
            "resultados": resultados_enriquecidos
        }
        
    except json.JSONDecodeError as je:
        raise HTTPException(
            status_code=500,
            detail=f"Gemini retornou um formato JSON invÃÂÃÂ¡lido: {response.text}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar imagem com Gemini OCR: {str(e)}"
        )

# ROTAS DE GERENCIAMENTO DA SALA
@app.post("/salas", response_model=SalaResponse, status_code=201)
def liberar_sala(dados_sala: CriarSalaInput, db: Session = Depends(get_db)):
    sala_existente = db.query(InfoSalaModel).filter(InfoSalaModel.numero_queda == dados_sala.numero_queda).first()
    if sala_existente:
        sala_existente.sala_id = dados_sala.sala_id
        sala_existente.senha = dados_sala.senha
        db.commit()
        db.refresh(sala_existente)
        return sala_existente
        
    nova_sala = InfoSalaModel(numero_queda=dados_sala.numero_queda, sala_id=dados_sala.sala_id, senha=dados_sala.senha)
    db.add(nova_sala)
    db.commit()
    db.refresh(nova_sala)
    return nova_sala

@app.get("/salas/{numero_queda}", response_model=SalaResponse)
def obter_sala(numero_queda: int, db: Session = Depends(get_db)):
    sala = db.query(InfoSalaModel).filter(InfoSalaModel.numero_queda == numero_queda).first()
    if not sala:
        raise HTTPException(status_code=404, detail="Dados da sala para esta queda ainda nÃÂÃÂ£o foram liberados.")
    return sala

# ROTAS DE PONTUAÃÂÃÂÃÂÃÂO
@app.post("/quedas", status_code=201)
def registrar_queda(dados: RegistroQuedaBatch, db: Session = Depends(get_db)):
    # 1. Validar resultados e verificar duplicados antes de salvar
    for res in dados.resultados:
        jogador = db.query(JogadorModel).filter(JogadorModel.id == res.jogador_id).first()
        if not jogador:
            raise HTTPException(status_code=404, detail=f"Jogador ID {res.jogador_id} nÃÂÃÂ£o existe.")
            
        registro_duplicado = db.query(QuedaModel).filter(
            QuedaModel.numero_queda == dados.numero_queda, QuedaModel.jogador_id == res.jogador_id
        ).first()
        if registro_duplicado:
            raise HTTPException(status_code=400, detail=f"Jogador ID {res.jogador_id} jÃÂÃÂ¡ possui resultado registrado na Queda {dados.numero_queda}.")
            
    # 2. Registrar resultados e creditar saldo dos ganhadores
    def obter_premio(colocacao: int) -> float:
        if colocacao == 1: return 20.0
        if colocacao == 2: return 10.0
        if colocacao == 3: return 7.0
        if colocacao == 4: return 5.0
        if 5 <= colocacao <= 10: return 1.5
        return 0.0
        
    for res in dados.resultados:
        jogador = db.query(JogadorModel).filter(JogadorModel.id == res.jogador_id).first()
        # Creditar prÃÂÃÂªmio se houver
        premio = obter_premio(res.colocacao)
        if premio > 0.0:
            jogador.saldo += premio
            
        nova_pontuacao = QuedaModel(
            numero_queda=dados.numero_queda,
            jogador_id=res.jogador_id,
            colocacao=res.colocacao,
            abates=res.abates
        )
        db.add(nova_pontuacao)
        
    db.commit()
    return {"message": f"Resultados da Queda {dados.numero_queda} salvos e premiaÃÂÃÂ§ÃÂÃÂµes pagas!"}

# FunÃÂÃÂ§ÃÂÃÂ£o interna para obter classificaÃÂÃÂ§ÃÂÃÂ£o
def obter_classificacao_geral_interna(db: Session):
    jogadores = db.query(JogadorModel).all()
    leaderboard = []
    
    def get_premio(colocacao: int) -> float:
        if colocacao == 1: return 20.0
        if colocacao == 2: return 10.0
        if colocacao == 3: return 7.0
        if colocacao == 4: return 5.0
        if 5 <= colocacao <= 10: return 1.5
        return 0.0

    for jog in jogadores:
        quedas = db.query(QuedaModel).filter(QuedaModel.jogador_id == jog.id).all()
        total_pontos = sum(calcular_pontos(q.colocacao, q.abates) for q in quedas)
        total_abates = sum(q.abates for q in quedas)
        ganhos = sum(get_premio(q.colocacao) for q in quedas)
        leaderboard.append({
            "jogador_id": jog.id,
            "nick": jog.nick,
            "total_pontos": total_pontos,
            "total_abates": total_abates,
            "quedas_jogadas": len(quedas),
            "ganhos_reais": ganhos
        })
    leaderboard.sort(key=lambda x: (x["ganhos_reais"], x["total_pontos"], x["total_abates"]), reverse=True)
    for idx, item in enumerate(leaderboard):
        item["posicao"] = idx + 1
    return leaderboard

@app.get("/classificacao", response_model=List[ClassificacaoGeralResponse])
def obter_classificacao_geral_route(db: Session = Depends(get_db)):
    return obter_classificacao_geral_interna(db)

@app.get("/jogadores/{nick}/historico")
def obter_historico_jogador(nick: str, db: Session = Depends(get_db)):
    jogador = db.query(JogadorModel).filter(JogadorModel.nick == nick).first()
    if not jogador:
        raise HTTPException(status_code=404, detail="Jogador nÃÂÃÂ£o encontrado.")
    
    quedas = db.query(QuedaModel).filter(QuedaModel.jogador_id == jogador.id).all()
    
    def get_premio(colocacao: int) -> float:
        if colocacao == 1: return 20.0
        if colocacao == 2: return 10.0
        if colocacao == 3: return 7.0
        if colocacao == 4: return 5.0
        if 5 <= colocacao <= 10: return 1.5
        return 0.0

    history = []
    total_earnings = 0.0
    total_kills = 0
    total_matches = len(quedas)
    total_placement = 0
    
    for q in quedas:
        premio = get_premio(q.colocacao)
        total_earnings += premio
        total_kills += q.abates
        total_placement += q.colocacao
        history.append({
            "numero_queda": q.numero_queda,
            "colocacao": q.colocacao,
            "abates": q.abates,
            "premio": premio
        })
        
    average_placement = round(total_placement / total_matches, 1) if total_matches > 0 else 0.0
    
    return {
        "jogador": {
            "id": jogador.id,
            "nome": jogador.nome,
            "nick": jogador.nick
        },
        "totalEarnings": total_earnings,
        "totalKills": total_kills,
        "totalMatches": total_matches,
        "averagePlacement": average_placement,
        "history": sorted(history, key=lambda x: x["numero_queda"])
    }

# ==========================================
# FERRAMENTAS DO AGENTE DE IA (GEMINI TOOLS)
# ==========================================
def criar_jogador_ferramenta(nome: str, nick: str) -> str:
    """
    Cadastra um novo competidor (jogador) no campeonato.
    ParÃÂÃÂ¢metros:
    - nome: Nome completo do jogador (ex: JoÃÂÃÂ£o da Silva)
    - nick: Nickname de jogo do jogador (ex: Nobru)
    """
    db = SessionLocal()
    try:
        db_jogador = db.query(JogadorModel).filter(JogadorModel.nick == nick).first()
        if db_jogador:
            return f"Erro: O jogador com nick '{nick}' jÃÂÃÂ¡ estÃÂÃÂ¡ cadastrado no sistema."
        
        default_hash = hash_senha("1234")
        novo_jogador = JogadorModel(
            nome=nome,
            nick=nick,
            senha_hash=default_hash,
            saldo=0.0,
            is_admin=False
        )
        db.add(novo_jogador)
        db.commit()
        db.refresh(novo_jogador)
        return f"Sucesso: Jogador '{nome}' com o nick '{nick}' cadastrado com sucesso!"
    except Exception as e:
        db.rollback()
        return f"Erro ao criar jogador: {str(e)}"
    finally:
        db.close()

def liberar_sala_ferramenta(numero_queda: int, sala_id: str, senha: str) -> str:
    """
    Cadastra ou atualiza o ID da sala e a Senha para uma queda (partida) especÃÂÃÂ­fica.
    ParÃÂÃÂ¢metros:
    - numero_queda: O nÃÂÃÂºmero da partida/queda (ex: 1, 2, 3)
    - sala_id: O ID numÃÂÃÂ©rico da sala personalizada gerado pelo Free Fire (ex: 88392)
    - senha: A senha definida para a sala personalizada (ex: 1234)
    """
    db = SessionLocal()
    try:
        sala_existente = db.query(InfoSalaModel).filter(InfoSalaModel.numero_queda == numero_queda).first()
        if sala_existente:
            sala_existente.sala_id = sala_id
            sala_existente.senha = senha
            db.commit()
            return f"Sucesso: Dados de sala para a Queda {numero_queda} atualizados. ID: {sala_id}, Senha: {senha}."
            
        nova_sala = InfoSalaModel(numero_queda=numero_queda, sala_id=sala_id, senha=senha)
        db.add(nova_sala)
        db.commit()
        return f"Sucesso: Sala para a Queda {numero_queda} liberada com sucesso! ID: {sala_id}, Senha: {senha}."
    except Exception as e:
        db.rollback()
        return f"Erro ao liberar sala: {str(e)}"
    finally:
        db.close()

def registrar_resultado_individual_ferramenta(numero_queda: int, jogador_nick: str, colocacao: int, abates: int) -> str:
    """
    Registra a pontuaÃÂÃÂ§ÃÂÃÂ£o e abates obtidos por um jogador em uma queda especÃÂÃÂ­fica.
    ParÃÂÃÂ¢metros:
    - numero_queda: O nÃÂÃÂºmero da queda em que a partida ocorreu (ex: 1, 2)
    - jogador_nick: O nickname exato do jogador participante (ex: Nobru)
    - colocacao: A posiÃÂÃÂ§ÃÂÃÂ£o final do jogador na partida (entre 1 e 48)
    - abates: A quantidade de eliminaÃÂÃÂ§ÃÂÃÂµes (abates/kills) feitas por esse jogador
    """
    db = SessionLocal()
    try:
        jogador = db.query(JogadorModel).filter(JogadorModel.nick == jogador_nick).first()
        if not jogador:
            return f"Erro: O jogador com o nick '{jogador_nick}' nÃÂÃÂ£o estÃÂÃÂ¡ cadastrado no campeonato."
            
        registro_duplicado = db.query(QuedaModel).filter(
            QuedaModel.numero_queda == numero_queda, QuedaModel.jogador_id == jogador.id
        ).first()
        if registro_duplicado:
            return f"Erro: O jogador '{jogador_nick}' jÃÂÃÂ¡ possui pontuaÃÂÃÂ§ÃÂÃÂ£o cadastrada para a Queda {numero_queda}."
            
        # Creditar prÃÂÃÂªmio se houver colocaÃÂÃÂ§ÃÂÃÂ£o premiada
        def obter_premio(col: int) -> float:
            if col == 1: return 20.0
            if col == 2: return 10.0
            if col == 3: return 7.0
            if col == 4: return 5.0
            if 5 <= col <= 10: return 1.5
            return 0.0

        premio = obter_premio(colocacao)
        if premio > 0.0:
            jogador.saldo += premio

        nova_pontuacao = QuedaModel(
            numero_queda=numero_queda,
            jogador_id=jogador.id,
            colocacao=colocacao,
            abates=abates
        )
        db.add(nova_pontuacao)
        db.commit()
        return f"Sucesso: PontuaÃÂÃÂ§ÃÂÃÂ£o gravada para '{jogador_nick}' na Queda {numero_queda}. ColocaÃÂÃÂ§ÃÂÃÂ£o: {colocacao}ÃÂÃÂº lugar, Abates: {abates}."
    except Exception as e:
        db.rollback()
        return f"Erro ao registrar pontuaÃÂÃÂ§ÃÂÃÂ£o individual: {str(e)}"
    finally:
        db.close()

def listar_jogadores_cadastrados_ferramenta() -> str:
    """
    Retorna a lista de todos os competidores (jogadores) cadastrados no campeonato.
    ÃÂÃÂtil para consultar IDs, nomes e nicks cadastrados no banco de dados.
    """
    import json
    db = SessionLocal()
    try:
        jogadores = db.query(JogadorModel).all()
        if not jogadores:
            return "Nenhum jogador cadastrado no sistema."
        lista = [{"id": j.id, "nome": j.nome, "nick": j.nick} for j in jogadores]
        return json.dumps(lista, ensure_ascii=False)
    except Exception as e:
        return f"Erro ao listar jogadores: {str(e)}"
    finally:
        db.close()

def obter_classificacao_atual_ferramenta() -> str:
    """
    Retorna a classificaÃÂÃÂ§ÃÂÃÂ£o geral atual do campeonato (leaderboard), contendo os pontos,
    abates, quedas jogadas e ganhos em dinheiro acumulados de cada jogador.
    """
    import json
    db = SessionLocal()
    try:
        classificacao = obter_classificacao_geral_interna(db)
        return json.dumps(classificacao, ensure_ascii=False)
    except Exception as e:
        return f"Erro ao obter classificaÃÂÃÂ§ÃÂÃÂ£o: {str(e)}"
    finally:
        db.close()

def cadastrar_jogadores_lote_ferramenta(jogadores_json: str) -> str:
    """
    Cadastra mÃÂÃÂºltiplos competidores (jogadores) de uma ÃÂÃÂºnica vez (em lote).
    ParÃÂÃÂ¢metros:
    - jogadores_json: String no formato JSON contendo uma lista de objetos com 'nome' e 'nick'. 
                      Exemplo: '[{"nome": "Felipe", "nick": "Lipe"}, {"nome": "Gabriel", "nick": "Biel"}]'
    """
    import json
    db = SessionLocal()
    try:
        dados_jogadores = json.loads(jogadores_json)
        if not isinstance(dados_jogadores, list):
            return "Erro: O JSON enviado deve ser uma lista de jogadores."
        
        sucessos = []
        erros = []
        default_hash = hash_senha("1234")
        for jog in dados_jogadores:
            nome = jog.get("nome", "").strip()
            nick = jog.get("nick", "").strip()
            if not nome or not nick:
                erros.append(f"Jogador invÃÂÃÂ¡lido (nome ou nick ausente): {jog}")
                continue
                
            db_jogador = db.query(JogadorModel).filter(JogadorModel.nick == nick).first()
            if db_jogador:
                erros.append(f"Nick '{nick}' jÃÂÃÂ¡ cadastrado.")
                continue
                
            novo_jogador = JogadorModel(
                nome=nome,
                nick=nick,
                senha_hash=default_hash,
                saldo=0.0,
                is_admin=False
            )
            db.add(novo_jogador)
            sucessos.append(f"'{nome}' ({nick})")
            
        db.commit()
        
        resultado = []
        if sucessos:
            resultado.append(f"Sucesso ao cadastrar: {', '.join(sucessos)}.")
        if erros:
            resultado.append(f"Erros/Duplicados: {'; '.join(erros)}.")
        return " | ".join(resultado)
    except Exception as e:
        db.rollback()
        return f"Erro ao processar o cadastro em lote: {str(e)}"
    finally:
        db.close()

def registrar_resultados_lote_ferramenta(numero_queda: int, resultados_json: str) -> str:
    """
    Registra a pontuaÃÂÃÂ§ÃÂÃÂ£o e abates de mÃÂÃÂºltiplos jogadores (ou de toda a partida) para uma queda especÃÂÃÂ­fica em lote.
    ParÃÂÃÂ¢metros:
    - numero_queda: O nÃÂÃÂºmero da queda/partida (ex: 1, 2)
    - resultados_json: String JSON contendo uma lista de objetos com 'jogador_nick', 'colocacao' (1 a 48) e 'abates'.
                       Exemplo: '[{"jogador_nick": "Lipe", "colocacao": 1, "abates": 5}, {"jogador_nick": "Biel", "colocacao": 2, "abates": 2}]'
    """
    import json
    db = SessionLocal()
    try:
        dados_resultados = json.loads(resultados_json)
        if not isinstance(dados_resultados, list):
            return "Erro: O JSON de resultados deve ser uma lista."
            
        sucessos = []
        erros = []
        
        def obter_premio(col: int) -> float:
            if col == 1: return 20.0
            if col == 2: return 10.0
            if col == 3: return 7.0
            if col == 4: return 5.0
            if 5 <= col <= 10: return 1.5
            return 0.0

        for res in dados_resultados:
            nick = res.get("jogador_nick", "").strip()
            colocacao = res.get("colocacao")
            abates = res.get("abates", 0)
            
            if not nick or colocacao is None:
                erros.append(f"Resultado invÃÂÃÂ¡lido (nick ou colocaÃÂÃÂ§ÃÂÃÂ£o ausente): {res}")
                continue
                
            try:
                colocacao = int(colocacao)
                abates = int(abates)
            except ValueError:
                erros.append(f"ColocaÃÂÃÂ§ÃÂÃÂ£o ou abates invÃÂÃÂ¡lidos para o nick '{nick}': {res}")
                continue
                
            if colocacao < 1 or colocacao > 52:
                erros.append(f"ColocaÃÂÃÂ§ÃÂÃÂ£o invÃÂÃÂ¡lida para o nick '{nick}' (deve ser entre 1 e 52): {colocacao}")
                continue
                
            jogador = db.query(JogadorModel).filter(JogadorModel.nick == nick).first()
            if not jogador:
                erros.append(f"Nick '{nick}' nÃÂÃÂ£o encontrado.")
                continue
                
            registro_duplicado = db.query(QuedaModel).filter(
                QuedaModel.numero_queda == numero_queda, QuedaModel.jogador_id == jogador.id
            ).first()
            if registro_duplicado:
                erros.append(f"O jogador '{nick}' jÃÂÃÂ¡ pontuou na Queda {numero_queda}.")
                continue
                
            # Creditar prÃÂÃÂªmio se houver
            premio = obter_premio(colocacao)
            if premio > 0.0:
                jogador.saldo += premio

            nova_pontuacao = QuedaModel(
                numero_queda=numero_queda,
                jogador_id=jogador.id,
                colocacao=colocacao,
                abates=abates
            )
            db.add(nova_pontuacao)
            sucessos.append(f"'{nick}' em {colocacao}ÃÂÃÂº lugar ({abates} abates)")
            
        db.commit()
        
        resultado = []
        if sucessos:
            resultado.append(f"Sucesso ao registrar na Queda {numero_queda}: {', '.join(sucessos)}.")
        if erros:
            resultado.append(f"Erros encontrados: {'; '.join(erros)}.")
        return " | ".join(resultado)
    except Exception as e:
        db.rollback()
        return f"Erro ao registrar resultados em lote: {str(e)}"
    finally:
        db.close()

class AgenteComandoInput(BaseModel):
    comando: str
    api_key: Optional[str] = None

@app.post("/agente/comando")
def processar_comando_agente(dados: AgenteComandoInput):
    try:
        import google.generativeai as genai
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="A biblioteca 'google-generativeai' nÃÂÃÂ£o estÃÂÃÂ¡ instalada no servidor. Por favor, instale executando 'pip install google-generativeai'."
        )
        
    api_key = dados.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Chave de API do Gemini nÃÂÃÂ£o configurada. Configure a variÃÂÃÂ¡vel de ambiente GEMINI_API_KEY ou envie sua chave pelo painel de chat."
        )
        
    try:
        genai.configure(api_key=api_key)
        ferramentas = [
            criar_jogador_ferramenta,
            liberar_sala_ferramenta,
            registrar_resultado_individual_ferramenta,
            listar_jogadores_cadastrados_ferramenta,
            obter_classificacao_atual_ferramenta,
            cadastrar_jogadores_lote_ferramenta,
            registrar_resultados_lote_ferramenta
        ]
        
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            tools=ferramentas,
            system_instruction=(
                "VocÃÂÃÂª ÃÂÃÂ© o assistente virtual inteligente administrador do campeonato de Free Fire (Modo Solo).\n"
                "Seu dever ÃÂÃÂ© receber comandos do organizador e chamar a ferramenta apropriada correspondente.\n"
                "VocÃÂÃÂª tem o superpoder de gerenciar todo o campeonato por texto natural:\n"
                "1. Cadastrar competidores (individuais usando criar_jogador_ferramenta ou mÃÂÃÂºltiplos usando cadastrar_jogadores_lote_ferramenta).\n"
                "2. Liberar ou atualizar IDs e senhas de salas personalizadas para os jogadores (usando liberar_sala_ferramenta).\n"
                "3. Consultar a lista de jogadores cadastrados para bater nicks e IDs (usando listar_jogadores_cadastrados_ferramenta).\n"
                "4. Consultar a tabela de classificaÃÂÃÂ§ÃÂÃÂ£o/leaderboard (usando obter_classificacao_atual_ferramenta) para responder dÃÂÃÂºvidas de posiÃÂÃÂ§ÃÂÃÂµes.\n"
                "5. Registrar resultados/abates de partidas (individual usando registrar_resultado_individual_ferramenta ou mÃÂÃÂºltiplos jogadores em lote de uma vez sÃÂÃÂ³ usando registrar_resultados_lote_ferramenta).\n\n"
                "ATENÃÂÃÂÃÂÃÂO COM RESULTADOS DE FIM DE JOGO:\n"
                "Se o organizador enviar uma lista de resultados (ex: tabela copiando e colando, ou frase listando vÃÂÃÂ¡rios jogadores), faÃÂÃÂ§a o seguinte:\n"
                "a) Chame listar_jogadores_cadastrados_ferramenta para buscar os nicks corretos se necessÃÂÃÂ¡rio e verificar se existem.\n"
                "b) Extraia de cada linha o nick, colocaÃÂÃÂ§ÃÂÃÂ£o (ex: 1ÃÂÃÂº, 2ÃÂÃÂº) e abates.\n"
                "c) Chame a ferramenta registrar_resultados_lote_ferramenta fornecendo o nÃÂÃÂºmero da queda e os dados no formato JSON exigido (uma lista de objetos com 'jogador_nick', 'colocacao' e 'abates').\n\n"
                "Sempre responda de maneira profissional, prestativa e em portuguÃÂÃÂªs brasileiro.\n"
                "Ao terminar uma aÃÂÃÂ§ÃÂÃÂ£o com sucesso, informe ao organizador de forma clara e resumida os detalhes da operaÃÂÃÂ§ÃÂÃÂ£o executada no banco de dados."
            )
        )
        
        chat = model.start_chat(enable_automatic_function_calling=True)
        response = chat.send_message(dados.comando)
        return {"resposta": response.text}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar comando com o Gemini: {str(e)}"
        )
