import os
import json
import base64
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from jose import JWTError, jwt
from passlib.context import CryptContext

# ====================== CONFIG JWT ======================
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY nao configurada. Defina no Railway antes de iniciar.')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 7 * 24 * 60

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
security = HTTPBearer()

# ====================== DATABASE ======================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get('DATABASE_URL', f'sqlite:///{BASE_DIR}/campeonato_freefire.db')

if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+pg8000://', 1)
elif DATABASE_URL.startswith('postgresql://') and 'pg8000' not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+pg8000://', 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={'check_same_thread': False} if 'sqlite' in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ====================== MODELOS ======================
class JogadorModel(Base):
    __tablename__ = 'jogadores'
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    nick = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=True)
    saldo = Column(Float, default=0.0)
    is_admin = Column(Boolean, default=False)
    inscricoes = relationship('InscricaoModel', back_populates='jogador')
    resultados = relationship('ResultadoQuedaModel', back_populates='jogador')
    depositos = relationship('DepositoRequisicaoModel', back_populates='jogador')

class QuedaModel(Base):
    __tablename__ = 'quedas'
    id = Column(Integer, primary_key=True, index=True)
    numero_queda = Column(Integer, unique=True, nullable=False, index=True)
    sala_id = Column(String, nullable=True)
    sala_senha = Column(String, nullable=True)
    status = Column(String, default='aberta')
    inscricoes = relationship('InscricaoModel', back_populates='queda')
    resultados = relationship('ResultadoQuedaModel', back_populates='queda')

class InscricaoModel(Base):
    __tablename__ = 'inscricoes'
    id = Column(Integer, primary_key=True, index=True)
    jogador_id = Column(Integer, ForeignKey('jogadores.id'), nullable=False)
    numero_queda = Column(Integer, ForeignKey('quedas.numero_queda'), nullable=False)
    data_inscricao = Column(DateTime, default=datetime.utcnow)
    jogador = relationship('JogadorModel', back_populates='inscricoes')
    queda = relationship('QuedaModel', back_populates='inscricoes')

class ResultadoQuedaModel(Base):
    __tablename__ = 'resultados_queda'
    id = Column(Integer, primary_key=True, index=True)
    jogador_id = Column(Integer, ForeignKey('jogadores.id'), nullable=False)
    numero_queda = Column(Integer, ForeignKey('quedas.numero_queda'), nullable=False)
    colocacao = Column(Integer, nullable=False)
    abates = Column(Integer, default=0)
    premio = Column(Float, default=0.0)
    jogador = relationship('JogadorModel', back_populates='resultados')
    queda = relationship('QuedaModel', back_populates='resultados')

class DepositoRequisicaoModel(Base):
    __tablename__ = 'depositos_requisicao'
    id = Column(Integer, primary_key=True, index=True)
    jogador_id = Column(Integer, ForeignKey('jogadores.id'), nullable=False)
    valor = Column(Float, nullable=False)
    status = Column(String, default='pendente')
    data_hora = Column(String, default=lambda: datetime.utcnow().strftime('%d/%m/%Y %H:%M'))
    jogador = relationship('JogadorModel', back_populates='depositos')

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
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def obter_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get('sub'))
        jogador = db.query(JogadorModel).filter(JogadorModel.id == user_id).first()
        if not jogador:
            raise HTTPException(404, 'Usuario nao encontrado')
        return jogador
    except Exception:
        raise HTTPException(401, 'Token invalido ou expirado')

def require_admin(jogador: JogadorModel = Depends(obter_usuario_atual)):
    if not jogador.is_admin:
        raise HTTPException(403, 'Acesso restrito ao administrador.')
    return jogador

def calcular_premio(colocacao: int, abates: int) -> float:
    if colocacao == 1: base = 20.0
    elif colocacao == 2: base = 10.0
    elif colocacao == 3: base = 7.0
    elif 4 <= colocacao <= 5: base = 5.0
    elif 6 <= colocacao <= 10: base = 3.0
    elif 11 <= colocacao <= 20: base = 1.0
    else: base = 0.0
    return base + (abates * 0.5)

# ====================== SCHEMAS ======================
class JogadorCreate(BaseModel):
    nome: str
    nick: str
    senha: Optional[str] = None

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

class SalaInput(BaseModel):
    sala_id: str
    sala_senha: str

class ResultadoInput(BaseModel):
    jogador_id: int
    colocacao: int
    abates: int = 0

class LancarResultadoBody(BaseModel):
    numero_queda: int
    resultados: List[ResultadoInput]

class ProcessarDepositoBody(BaseModel):
    status: str

class ComandoAgenteBody(BaseModel):
    comando: str

# ====================== APP ======================
app = FastAPI(title='Campeonato Free Fire')

ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://camp-freefire.vercel.app'
).split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Incluir router PIX da Cora
try:
    from cora_pix import router as pix_router
    app.include_router(pix_router)
    print('Router PIX Cora incluido com sucesso.')
except ImportError as e:
    print(f'Aviso: cora_pix nao disponivel: {e}')

# ====================== ROTAS AUTH ======================
@app.post('/auth/cadastro', response_model=JogadorResponse)
def cadastrar(jogador: JogadorCreate, db: Session = Depends(get_db)):
    if db.query(JogadorModel).filter(JogadorModel.nick == jogador.nick).first():
        raise HTTPException(400, 'Nick ja existe')
    senha_hash = hash_senha(jogador.senha) if jogador.senha else hash_senha('sem_senha_' + jogador.nick)
    is_first = db.query(JogadorModel).count() == 0
    novo = JogadorModel(
        nome=jogador.nome, nick=jogador.nick,
        senha_hash=senha_hash, saldo=0.0, is_admin=is_first
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

@app.post('/auth/login')
def login(dados: JogadorLogin, db: Session = Depends(get_db)):
    jogador = db.query(JogadorModel).filter(JogadorModel.nick == dados.nick).first()
    if not jogador or not verificar_senha(dados.senha, jogador.senha_hash):
        raise HTTPException(401, 'Nick ou senha incorretos')
    token = criar_access_token({'sub': str(jogador.id)})
    return {
        'access_token': token,
        'token_type': 'bearer',
        'jogador': {
            'id': jogador.id, 'nome': jogador.nome, 'nick': jogador.nick,
            'saldo': jogador.saldo, 'is_admin': jogador.is_admin
        }
    }

@app.get('/me', response_model=JogadorResponse)
def me(jogador: JogadorModel = Depends(obter_usuario_atual)):
    return jogador

# ====================== CLASSIFICACAO (PUBLICA) ======================
@app.get('/classificacao')
def classificacao(db: Session = Depends(get_db)):
    jogadores = db.query(JogadorModel).all()
    resultado = []
    for j in jogadores:
        res_list = db.query(ResultadoQuedaModel).filter(ResultadoQuedaModel.jogador_id == j.id).all()
        total_premios = sum(r.premio for r in res_list)
        total_abates = sum(r.abates for r in res_list)
        total_quedas = len(res_list)
        colocacoes = [r.colocacao for r in res_list]
        melhor = min(colocacoes) if colocacoes else None
        resultado.append({
            'id': j.id, 'nick': j.nick, 'nome': j.nome, 'saldo': j.saldo,
            'total_premios': total_premios, 'total_abates': total_abates,
            'total_quedas': total_quedas, 'melhor_colocacao': melhor
        })
    resultado.sort(key=lambda x: (-x['total_premios'], -x['total_abates']))
    return resultado

# ====================== JOGADORES ======================
@app.get('/jogadores')
def listar_jogadores(_admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    jogadores = db.query(JogadorModel).all()
    return [{'id': j.id, 'nome': j.nome, 'nick': j.nick, 'saldo': j.saldo, 'is_admin': j.is_admin} for j in jogadores]

@app.get('/historico/{nick}')
def historico_jogador(nick: str, db: Session = Depends(get_db)):
    jogador = db.query(JogadorModel).filter(JogadorModel.nick == nick).first()
    if not jogador:
        raise HTTPException(404, 'Jogador nao encontrado')
    res_list = db.query(ResultadoQuedaModel).filter(
        ResultadoQuedaModel.jogador_id == jogador.id
    ).order_by(ResultadoQuedaModel.numero_queda).all()
    history = [{'numero_queda': r.numero_queda, 'colocacao': r.colocacao, 'abates': r.abates, 'premio': r.premio} for r in res_list]
    total_matches = len(res_list)
    return {
        'jogador': {'id': jogador.id, 'nick': jogador.nick, 'nome': jogador.nome, 'saldo': jogador.saldo, 'is_admin': jogador.is_admin},
        'history': history,
        'totalEarnings': sum(r.premio for r in res_list),
        'totalKills': sum(r.abates for r in res_list),
        'totalMatches': total_matches,
        'averagePlacement': round(sum(r.colocacao for r in res_list) / total_matches, 1) if total_matches else 0
    }

# ====================== QUEDAS ======================
@app.get('/queda/{numero}/status')
def status_queda(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual), db: Session = Depends(get_db)):
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    inscritos = db.query(InscricaoModel).filter(InscricaoModel.numero_queda == numero).count()
    esta_inscrito = db.query(InscricaoModel).filter(
        InscricaoModel.numero_queda == numero, InscricaoModel.jogador_id == jogador.id
    ).first() is not None
    sala_liberada = queda is not None and queda.sala_id is not None
    return {'numero_queda': numero, 'inscritos_count': inscritos, 'limite': 52, 'esta_inscrito': esta_inscrito, 'sala_liberada': sala_liberada}

@app.get('/queda/{numero}/sala')
def info_sala(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual), db: Session = Depends(get_db)):
    esta_inscrito = db.query(InscricaoModel).filter(
        InscricaoModel.numero_queda == numero, InscricaoModel.jogador_id == jogador.id
    ).first()
    if not esta_inscrito:
        raise HTTPException(403, 'Voce nao esta inscrito nesta queda')
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    if not queda or not queda.sala_id:
        raise HTTPException(404, 'Sala ainda nao foi liberada pelo administrador')
    return {'sala_id': queda.sala_id, 'senha': queda.sala_senha}

@app.post('/queda/{numero}/inscrever')
def inscrever(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual), db: Session = Depends(get_db)):
    if db.query(InscricaoModel).filter(InscricaoModel.numero_queda == numero, InscricaoModel.jogador_id == jogador.id).first():
        raise HTTPException(400, 'Voce ja esta inscrito nesta queda')
    if jogador.saldo < 2.0:
        raise HTTPException(400, 'Saldo insuficiente. Necessario R$ 2,00')
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    if not queda:
        queda = QuedaModel(numero_queda=numero, status='aberta')
        db.add(queda)
        db.flush()
    jogador.saldo -= 2.0
    db.add(InscricaoModel(jogador_id=jogador.id, numero_queda=numero))
    db.commit()
    return {'message': 'Inscricao confirmada! R$ 2,00 debitados do seu saldo.'}

@app.post('/queda/{numero}/sala')
def liberar_sala(numero: int, dados: SalaInput, _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    if not queda:
        queda = QuedaModel(numero_queda=numero, status='aberta')
        db.add(queda)
        db.flush()
    queda.sala_id = dados.sala_id
    queda.sala_senha = dados.sala_senha
    db.commit()
    return {'message': f'Sala da queda {numero} liberada com sucesso!'}

@app.post('/queda/{numero}/resultado')
def lancar_resultado(numero: int, body: LancarResultadoBody, _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    for res in body.resultados:
        jogador = db.query(JogadorModel).filter(JogadorModel.id == res.jogador_id).first()
        if not jogador:
            raise HTTPException(404, f'Jogador ID {res.jogador_id} nao encontrado')
        if db.query(ResultadoQuedaModel).filter(ResultadoQuedaModel.numero_queda == numero, ResultadoQuedaModel.jogador_id == res.jogador_id).first():
            raise HTTPException(400, f'Resultado ja lancado para {jogador.nick} na queda {numero}')
        premio = calcular_premio(res.colocacao, res.abates)
        db.add(ResultadoQuedaModel(jogador_id=res.jogador_id, numero_queda=numero, colocacao=res.colocacao, abates=res.abates, premio=premio))
        jogador.saldo += premio
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    if queda: queda.status = 'encerrada'
    db.commit()
    return {'message': f'Resultados da queda {numero} lancados e premios pagos!'}

@app.post('/queda/{numero}/cancelar')
def cancelar_queda(numero: int, _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    inscricoes = db.query(InscricaoModel).filter(InscricaoModel.numero_queda == numero).all()
    if not inscricoes:
        raise HTTPException(404, f'Nenhuma inscricao na queda {numero}')
    for inscricao in inscricoes:
        jog = db.query(JogadorModel).filter(JogadorModel.id == inscricao.jogador_id).first()
        if jog: jog.saldo += 2.0
        db.delete(inscricao)
    queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == numero).first()
    if queda: queda.status = 'cancelada'
    db.commit()
    return {'message': f'Queda {numero} cancelada. Jogadores reembolsados com R$ 2,00.'}

# ====================== DEPOSITOS ======================
@app.get('/depositos/pendentes')
def depositos_pendentes(_admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    deps = db.query(DepositoRequisicaoModel).filter(DepositoRequisicaoModel.status == 'pendente').all()
    return [{'id': d.id, 'jogador_id': d.jogador_id, 'jogador_nick': d.jogador.nick if d.jogador else None, 'valor': d.valor, 'status': d.status, 'data_hora': d.data_hora} for d in deps]

@app.post('/depositos/{deposito_id}/processar')
def processar_deposito(deposito_id: int, body: ProcessarDepositoBody, _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    dep = db.query(DepositoRequisicaoModel).filter(DepositoRequisicaoModel.id == deposito_id).first()
    if not dep: raise HTTPException(404, 'Deposito nao encontrado')
    if dep.status != 'pendente': raise HTTPException(400, 'Deposito ja processado')
    dep.status = body.status
    if body.status == 'aprovado':
        jog = db.query(JogadorModel).filter(JogadorModel.id == dep.jogador_id).first()
        if jog: jog.saldo += dep.valor
    db.commit()
    return {'message': f'Deposito {deposito_id} {body.status} com sucesso.'}

@app.post('/depositos/solicitar')
def solicitar_deposito(valor: float, jogador: JogadorModel = Depends(obter_usuario_atual), db: Session = Depends(get_db)):
    dep = DepositoRequisicaoModel(
        jogador_id=jogador.id, valor=valor, status='pendente',
        data_hora=datetime.utcnow().strftime('%d/%m/%Y %H:%M')
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {'message': 'Solicitacao de deposito registrada.', 'id': dep.id}

# ====================== OCR + AGENTE IA ======================
@app.post('/ocr/resultado')
async def ocr_resultado(
    numero_queda: int = Form(...),
    imagem: UploadFile = File(...),
    _admin: JogadorModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    GEMINI_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_KEY: raise HTTPException(503, 'GEMINI_API_KEY nao configurada.')
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
    except ImportError:
        raise HTTPException(503, 'Dependencia google-generativeai nao instalada.')
    conteudo = await imagem.read()
    img_b64 = base64.b64encode(conteudo).decode('utf-8')
    mime = imagem.content_type or 'image/png'
    jogadores = db.query(JogadorModel).all()
    lista_nicks = ', '.join([j.nick for j in jogadores])
    prompt = ('Analise este print de placar do Free Fire. '
              f'Jogadores cadastrados: {lista_nicks}. '
              'Para cada jogador no placar, retorne JSON: '
              '[{"nick_detectado": str, "nick_cadastrado": str_ou_null, "colocacao": int, "abates": int}]. '
              'Retorne APENAS o JSON.')
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content([{'mime_type': mime, 'data': img_b64}, prompt])
    try:
        texto = response.text.strip()
        if '```' in texto:
            partes = texto.split('```')
            texto = partes[1] if len(partes) > 1 else texto
            if texto.startswith('json'): texto = texto[4:]
        dados_ocr = json.loads(texto.strip())
    except Exception:
        raise HTTPException(422, 'Gemini nao retornou JSON valido.')
    resultados = []
    for item in dados_ocr:
        nick_cad = item.get('nick_cadastrado')
        jog = db.query(JogadorModel).filter(JogadorModel.nick == nick_cad).first() if nick_cad else None
        resultados.append({
            'jogador_id': jog.id if jog else None,
            'jogador_nick': nick_cad or item.get('nick_detectado'),
            'colocacao': item.get('colocacao') or 52,
            'abates': item.get('abates') or 0
        })
    return {'resultados': resultados}

@app.post('/agente/comando')
async def agente_comando(
    body: ComandoAgenteBody,
    admin: JogadorModel = Depends(require_admin),
    db: Session = Depends(get_db)
):
    GEMINI_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_KEY: raise HTTPException(503, 'GEMINI_API_KEY nao configurada.')
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
    except ImportError:
        raise HTTPException(503, 'Dependencia google-generativeai nao instalada.')
    jogadores = db.query(JogadorModel).all()
    jogadores_info = json.dumps([{'id': j.id, 'nick': j.nick, 'nome': j.nome, 'saldo': j.saldo} for j in jogadores], ensure_ascii=False)
    prompt = (f'Voce gerencia o campeonato de Free Fire. Jogadores: {jogadores_info}. '
              f'Comando do admin: "{body.comando}". '
              'Retorne JSON: {"acao": str, "dados": dict, "resposta_texto": str}. '
              'Acoes possiveis: listar_jogadores, cadastrar_jogador, liberar_sala, lancar_resultado, informacao. '
              'Para cadastrar_jogador dados={nome,nick}. Para liberar_sala dados={numero_queda,sala_id,sala_senha}. '
              'Para lancar_resultado dados={numero_queda, resultados:[{jogador_id,colocacao,abates}]}. '
              'Retorne APENAS o JSON.')
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt)
    try:
        texto = response.text.strip()
        if '```' in texto:
            partes = texto.split('```')
            texto = partes[1] if len(partes) > 1 else texto
            if texto.startswith('json'): texto = texto[4:]
        r_ia = json.loads(texto.strip())
    except Exception:
        return {'resposta': f'Comando recebido mas nao processado automaticamente: {body.comando}'}
    acao = r_ia.get('acao', 'desconhecido')
    dados = r_ia.get('dados', {})
    resposta_texto = r_ia.get('resposta_texto', 'Processado.')
    if acao == 'listar_jogadores':
        nomes = ', '.join([f"{j['nick']} (R$ {j['saldo']:.2f})" for j in json.loads(jogadores_info)])
        return {'resposta': f'Jogadores: {nomes}'}
    elif acao == 'cadastrar_jogador':
        nome = dados.get('nome'); nick = dados.get('nick')
        if not nome or not nick: return {'resposta': 'Informe nome e nick para cadastrar.'}
        if db.query(JogadorModel).filter(JogadorModel.nick == nick).first():
            return {'resposta': f'Nick {nick} ja existe.'}
        novo = JogadorModel(nome=nome, nick=nick, senha_hash=hash_senha('padrao_' + nick), saldo=0.0, is_admin=False)
        db.add(novo); db.commit()
        return {'resposta': f'Jogador {nick} ({nome}) cadastrado com sucesso!'}
    elif acao == 'liberar_sala':
        num = dados.get('numero_queda'); sid = dados.get('sala_id'); ssn = dados.get('sala_senha')
        if not all([num, sid, ssn]): return {'resposta': 'Informe queda, ID e senha da sala.'}
        queda = db.query(QuedaModel).filter(QuedaModel.numero_queda == num).first()
        if not queda:
            queda = QuedaModel(numero_queda=num, status='aberta'); db.add(queda); db.flush()
        queda.sala_id = sid; queda.sala_senha = ssn; db.commit()
        return {'resposta': f'Sala queda {num}: ID={sid} | Senha={ssn}'}
    elif acao == 'lancar_resultado':
        num = dados.get('numero_queda'); resultados = dados.get('resultados', [])
        if not num or not resultados: return {'resposta': 'Informe queda e resultados.'}
        msgs = []
        for res in resultados:
            jog = db.query(JogadorModel).filter(JogadorModel.id == res.get('jogador_id')).first()
            if not jog: continue
            if db.query(ResultadoQuedaModel).filter(ResultadoQuedaModel.numero_queda == num, ResultadoQuedaModel.jogador_id == jog.id).first(): continue
            premio = calcular_premio(res.get('colocacao', 52), res.get('abates', 0))
            db.add(ResultadoQuedaModel(jogador_id=jog.id, numero_queda=num, colocacao=res.get('colocacao', 52), abates=res.get('abates', 0), premio=premio))
            jog.saldo += premio
            msgs.append(f"{jog.nick}: {res.get('colocacao')}o, {res.get('abates')} kills, R$ {premio:.2f}")
        db.commit()
        return {'resposta': f'Queda {num}: ' + (', '.join(msgs) if msgs else 'Nenhum novo resultado.')}
    return {'resposta': resposta_texto}

print('Backend Camp Free Fire iniciado!')
