"""Backend Camp Free Fire — FastAPI + SQLAlchemy 2.x + JWT."""
import os
import json
import base64
from typing import Optional, List

import httpx
from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from models import (JogadorModel, QuedaModel, InscricaoModel,
                    ResultadoQuedaModel, DepositoRequisicaoModel, SaqueRequisicaoModel)
from auth import (hash_senha, verificar_senha, criar_access_token, criar_refresh_token,
                  decodificar_token, obter_usuario_atual, require_admin)

# Cria tabelas se nao existirem (em producao o schema e gerido por migration no Supabase;
# create_all e no-op quando as tabelas ja existem)
if not os.environ.get('SKIP_DB_INIT'):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # nao derruba o cold start por causa disso
        print(f'[WARN] create_all falhou: {exc}')

TAXA_INSCRICAO = 2.0

# ====================== REGRAS DE PREMIO / PONTOS ======================
def calcular_premio(colocacao: int, abates: int) -> float:
    """Premio em R$ por queda. Tabela alinhada ao rodape do Leaderboard."""
    if colocacao == 1: base = 20.0
    elif colocacao == 2: base = 12.0
    elif colocacao == 3: base = 8.0
    elif colocacao == 4: base = 6.0
    elif 5 <= colocacao <= 10: base = 2.5
    else: base = 0.0
    return base + (abates * 0.5)


PONTOS_LBFF = {1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}

def calcular_pontos_lbff(colocacao: int, abates: int) -> int:
    return PONTOS_LBFF.get(colocacao, 0) + abates


# ====================== GEMINI (REST, sem SDK pesado) ======================
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')

async def gemini_generate(parts: list) -> str:
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise HTTPException(503, 'GEMINI_API_KEY nao configurada.')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'
    async with httpx.AsyncClient(timeout=60) as c:
        resp = await c.post(url, params={'key': key},
                            json={'contents': [{'parts': parts}]})
    if resp.status_code != 200:
        raise HTTPException(502, f'Erro Gemini ({resp.status_code}): {resp.text[:300]}')
    data = resp.json()
    try:
        return data['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        raise HTTPException(502, 'Gemini retornou resposta vazia.')


def extrair_json(texto: str):
    texto = texto.strip()
    if '```' in texto:
        partes = texto.split('```')
        texto = partes[1] if len(partes) > 1 else texto
        if texto.startswith('json'):
            texto = texto[4:]
    return json.loads(texto.strip())


# ====================== SCHEMAS ======================
class JogadorCreate(BaseModel):
    nome: str
    nick: str
    senha: Optional[str] = None

class JogadorLogin(BaseModel):
    nick: str
    senha: str

class RefreshBody(BaseModel):
    refresh_token: str

class JogadorResponse(BaseModel):
    id: int
    nome: str
    nick: str
    saldo: float
    is_admin: bool
    model_config = ConfigDict(from_attributes=True)

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

class SolicitarDepositoBody(BaseModel):
    valor: float

class ComandoAgenteBody(BaseModel):
    comando: str


# ====================== APP ======================
app = FastAPI(title='Campeonato Free Fire')

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    'ALLOWED_ORIGINS', 'https://camp-freefire.vercel.app,http://localhost:5173'
).split(',') if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

from cora_pix import router as pix_router
app.include_router(pix_router)


@app.get('/health')
def health(db: bool = False):
    if not db:
        return {'status': 'ok'}
    # /health?db=1 -> testa conexao com o banco
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return {'status': 'ok', 'db': 'ok'}
    except Exception as exc:
        return {'status': 'ok', 'db': 'erro', 'detail': f'{type(exc).__name__}: {str(exc)[:300]}'}


# ====================== AUTH ======================
def _payload_jogador(j: JogadorModel) -> dict:
    return {'id': j.id, 'nome': j.nome, 'nick': j.nick, 'saldo': j.saldo, 'is_admin': j.is_admin}


@app.post('/auth/cadastro', response_model=JogadorResponse)
def cadastrar(jogador: JogadorCreate, db: Session = Depends(get_db)):
    nick = jogador.nick.strip()
    if not nick or not jogador.nome.strip():
        raise HTTPException(400, 'Nome e nick sao obrigatorios')
    if not jogador.senha or len(jogador.senha) < 6:
        raise HTTPException(400, 'Senha obrigatoria (minimo 6 caracteres)')
    if db.scalar(select(JogadorModel).where(JogadorModel.nick == nick)):
        raise HTTPException(400, 'Nick ja existe')
    is_first = (db.scalar(select(func.count()).select_from(JogadorModel)) or 0) == 0
    novo = JogadorModel(nome=jogador.nome.strip(), nick=nick,
                        senha_hash=hash_senha(jogador.senha), saldo=0.0, is_admin=is_first)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@app.post('/auth/login')
def login(dados: JogadorLogin, db: Session = Depends(get_db)):
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.nick == dados.nick))
    if not jogador or not jogador.senha_hash or not verificar_senha(dados.senha, jogador.senha_hash):
        raise HTTPException(401, 'Nick ou senha incorretos')
    sub = {'sub': str(jogador.id)}
    return {
        'access_token': criar_access_token(sub),
        'refresh_token': criar_refresh_token(sub),
        'token_type': 'bearer',
        'jogador': _payload_jogador(jogador),
    }


@app.post('/auth/refresh')
def refresh(body: RefreshBody, db: Session = Depends(get_db)):
    payload = decodificar_token(body.refresh_token, 'refresh')
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.id == int(payload['sub'])))
    if not jogador:
        raise HTTPException(401, 'Usuario nao encontrado')
    sub = {'sub': str(jogador.id)}
    return {
        'access_token': criar_access_token(sub),
        'refresh_token': criar_refresh_token(sub),
        'token_type': 'bearer',
    }


class DefinirSenhaBody(BaseModel):
    nick: str
    senha: str


@app.post('/auth/definir-senha')
def definir_senha(body: DefinirSenhaBody, db: Session = Depends(get_db)):
    """Permite definir senha apenas para contas criadas pelo admin/agente sem senha."""
    if len(body.senha) < 6:
        raise HTTPException(400, 'Senha deve ter no minimo 6 caracteres')
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.nick == body.nick))
    if not jogador:
        raise HTTPException(404, 'Jogador nao encontrado')
    if jogador.senha_hash:
        raise HTTPException(400, 'Este jogador ja possui senha. Faca login.')
    jogador.senha_hash = hash_senha(body.senha)
    db.commit()
    return {'message': 'Senha definida com sucesso. Faca login.'}


@app.get('/me', response_model=JogadorResponse)
def me(jogador: JogadorModel = Depends(obter_usuario_atual)):
    return jogador


# ====================== CLASSIFICACAO (PUBLICA) ======================
@app.get('/classificacao')
def classificacao(db: Session = Depends(get_db)):
    jogadores = db.scalars(select(JogadorModel)).all()
    resultado = []
    for j in jogadores:
        res_list = db.scalars(select(ResultadoQuedaModel)
                              .where(ResultadoQuedaModel.jogador_id == j.id)).all()
        total_pontos = sum(calcular_pontos_lbff(r.colocacao, r.abates) for r in res_list)
        colocacoes = [r.colocacao for r in res_list]
        resultado.append({
            'id': j.id, 'jogador_id': j.id, 'nick': j.nick, 'nome': j.nome, 'saldo': j.saldo,
            'total_premios': sum(r.premio for r in res_list),
            'ganhos_reais': sum(r.premio for r in res_list),
            'total_abates': sum(r.abates for r in res_list),
            'total_quedas': len(res_list),
            'quedas_jogadas': len(res_list),
            'total_pontos': total_pontos,
            'melhor_colocacao': min(colocacoes) if colocacoes else None,
        })
    resultado.sort(key=lambda x: (-x['total_premios'], -x['total_pontos'], -x['total_abates']))
    for i, item in enumerate(resultado, start=1):
        item['posicao'] = i
    return resultado


# ====================== JOGADORES ======================
@app.get('/jogadores')
def listar_jogadores(_admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    jogadores = db.scalars(select(JogadorModel)).all()
    return [_payload_jogador(j) for j in jogadores]


@app.get('/historico/{nick}')
def historico_jogador(nick: str, db: Session = Depends(get_db)):
    jogador = db.scalar(select(JogadorModel).where(JogadorModel.nick == nick))
    if not jogador:
        raise HTTPException(404, 'Jogador nao encontrado')
    res_list = db.scalars(select(ResultadoQuedaModel)
                          .where(ResultadoQuedaModel.jogador_id == jogador.id)
                          .order_by(ResultadoQuedaModel.numero_queda)).all()
    total = len(res_list)
    return {
        'jogador': _payload_jogador(jogador),
        'history': [{'numero_queda': r.numero_queda, 'colocacao': r.colocacao,
                     'abates': r.abates, 'premio': r.premio} for r in res_list],
        'totalEarnings': sum(r.premio for r in res_list),
        'totalKills': sum(r.abates for r in res_list),
        'totalMatches': total,
        'averagePlacement': round(sum(r.colocacao for r in res_list) / total, 1) if total else 0,
    }


# ====================== QUEDAS ======================
def _get_queda(db: Session, numero: int) -> Optional[QuedaModel]:
    return db.scalar(select(QuedaModel).where(QuedaModel.numero_queda == numero))


def _get_inscricao(db: Session, numero: int, jogador_id: int) -> Optional[InscricaoModel]:
    return db.scalar(select(InscricaoModel).where(
        InscricaoModel.numero_queda == numero, InscricaoModel.jogador_id == jogador_id))


@app.get('/queda/{numero}/status')
def status_queda(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual),
                 db: Session = Depends(get_db)):
    queda = _get_queda(db, numero)
    inscritos = db.scalar(select(func.count()).select_from(InscricaoModel)
                          .where(InscricaoModel.numero_queda == numero)) or 0
    return {
        'numero_queda': numero, 'inscritos_count': inscritos, 'limite': 52,
        'esta_inscrito': _get_inscricao(db, numero, jogador.id) is not None,
        'sala_liberada': queda is not None and queda.sala_id is not None,
    }


@app.get('/queda/{numero}/sala')
def info_sala(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual),
              db: Session = Depends(get_db)):
    if not _get_inscricao(db, numero, jogador.id):
        raise HTTPException(403, 'Voce nao esta inscrito nesta queda')
    queda = _get_queda(db, numero)
    if not queda or not queda.sala_id:
        raise HTTPException(404, 'Sala ainda nao foi liberada pelo administrador')
    return {'sala_id': queda.sala_id, 'senha': queda.sala_senha}


@app.post('/queda/{numero}/inscrever')
def inscrever(numero: int, jogador: JogadorModel = Depends(obter_usuario_atual),
              db: Session = Depends(get_db)):
    if _get_inscricao(db, numero, jogador.id):
        raise HTTPException(400, 'Voce ja esta inscrito nesta queda')
    if jogador.saldo < TAXA_INSCRICAO:
        raise HTTPException(400, f'Saldo insuficiente. Necessario R$ {TAXA_INSCRICAO:.2f}')
    queda = _get_queda(db, numero)
    if queda and queda.status != 'aberta':
        raise HTTPException(400, f'Queda {numero} nao esta aberta para inscricoes')
    inscritos = db.scalar(select(func.count()).select_from(InscricaoModel)
                          .where(InscricaoModel.numero_queda == numero)) or 0
    if inscritos >= 52:
        raise HTTPException(400, 'Queda lotada (52 jogadores)')
    if not queda:
        queda = QuedaModel(numero_queda=numero, status='aberta')
        db.add(queda)
        db.flush()
    jogador.saldo -= TAXA_INSCRICAO
    db.add(InscricaoModel(jogador_id=jogador.id, numero_queda=numero))
    db.commit()
    return {'message': f'Inscricao confirmada! R$ {TAXA_INSCRICAO:.2f} debitados do seu saldo.'}


@app.post('/queda/{numero}/sala')
def liberar_sala(numero: int, dados: SalaInput,
                 _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    queda = _get_queda(db, numero)
    if not queda:
        queda = QuedaModel(numero_queda=numero, status='aberta')
        db.add(queda)
        db.flush()
    queda.sala_id = dados.sala_id
    queda.sala_senha = dados.sala_senha
    db.commit()
    return {'message': f'Sala da queda {numero} liberada com sucesso!'}


@app.post('/queda/{numero}/resultado')
def lancar_resultado(numero: int, body: LancarResultadoBody,
                     _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    for res in body.resultados:
        jogador = db.scalar(select(JogadorModel).where(JogadorModel.id == res.jogador_id))
        if not jogador:
            raise HTTPException(404, f'Jogador ID {res.jogador_id} nao encontrado')
        ja_tem = db.scalar(select(ResultadoQuedaModel).where(
            ResultadoQuedaModel.numero_queda == numero,
            ResultadoQuedaModel.jogador_id == res.jogador_id))
        if ja_tem:
            raise HTTPException(400, f'Resultado ja lancado para {jogador.nick} na queda {numero}')
        premio = calcular_premio(res.colocacao, res.abates)
        db.add(ResultadoQuedaModel(jogador_id=res.jogador_id, numero_queda=numero,
                                   colocacao=res.colocacao, abates=res.abates, premio=premio))
        jogador.saldo += premio
    queda = _get_queda(db, numero)
    if queda:
        queda.status = 'encerrada'
    db.commit()
    return {'message': f'Resultados da queda {numero} lancados e premios pagos!'}


@app.post('/queda/{numero}/cancelar')
def cancelar_queda(numero: int, _admin: JogadorModel = Depends(require_admin),
                   db: Session = Depends(get_db)):
    inscricoes = db.scalars(select(InscricaoModel)
                            .where(InscricaoModel.numero_queda == numero)).all()
    if not inscricoes:
        raise HTTPException(404, f'Nenhuma inscricao na queda {numero}')
    for inscricao in inscricoes:
        jog = db.scalar(select(JogadorModel).where(JogadorModel.id == inscricao.jogador_id))
        if jog:
            jog.saldo += TAXA_INSCRICAO
        db.delete(inscricao)
    queda = _get_queda(db, numero)
    if queda:
        queda.status = 'cancelada'
    db.commit()
    return {'message': f'Queda {numero} cancelada. Jogadores reembolsados com R$ {TAXA_INSCRICAO:.2f}.'}


# ====================== DEPOSITOS (manuais, aprovados pelo admin) ======================
@app.get('/depositos/pendentes')
def depositos_pendentes(_admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    deps = db.scalars(select(DepositoRequisicaoModel)
                      .where(DepositoRequisicaoModel.status == 'pendente')).all()
    return [{'id': d.id, 'jogador_id': d.jogador_id,
             'jogador_nick': d.jogador.nick if d.jogador else None,
             'valor': d.valor, 'status': d.status, 'data_hora': d.data_hora} for d in deps]


@app.post('/depositos/{deposito_id}/processar')
def processar_deposito(deposito_id: int, body: ProcessarDepositoBody,
                       _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    if body.status not in ('aprovado', 'rejeitado'):
        raise HTTPException(400, "Status deve ser 'aprovado' ou 'rejeitado'")
    dep = db.scalar(select(DepositoRequisicaoModel).where(DepositoRequisicaoModel.id == deposito_id))
    if not dep:
        raise HTTPException(404, 'Deposito nao encontrado')
    if dep.status != 'pendente':
        raise HTTPException(400, 'Deposito ja processado')
    dep.status = body.status
    if body.status == 'aprovado':
        jog = db.scalar(select(JogadorModel).where(JogadorModel.id == dep.jogador_id))
        if jog:
            jog.saldo += dep.valor
    db.commit()
    return {'message': f'Deposito {deposito_id} {body.status} com sucesso.'}


@app.post('/depositos/solicitar')
def solicitar_deposito(valor: Optional[float] = None,
                       body: Optional[SolicitarDepositoBody] = Body(None),
                       jogador: JogadorModel = Depends(obter_usuario_atual),
                       db: Session = Depends(get_db)):
    v = body.valor if body else valor
    if v is None or v <= 0:
        raise HTTPException(400, 'Valor invalido')
    from models import utcnow
    dep = DepositoRequisicaoModel(jogador_id=jogador.id, valor=v, status='pendente',
                                  data_hora=utcnow().strftime('%d/%m/%Y %H:%M'))
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {'message': 'Solicitacao de deposito registrada.', 'id': dep.id}


class DadosBancariosBody(BaseModel):
    banco_codigo: str
    agencia: str
    conta: str
    tipo_conta: str = 'CHECKING'
    titular_nome: str
    titular_doc: str
    chave_pix: str


def _dados_bancarios_dict(j: JogadorModel) -> dict:
    return {'banco_codigo': j.banco_codigo, 'agencia': j.agencia, 'conta': j.conta,
            'tipo_conta': j.tipo_conta, 'titular_nome': j.titular_nome,
            'titular_doc': j.titular_doc, 'chave_pix': j.chave_pix,
            'completo': bool(j.banco_codigo and j.agencia and j.conta and j.titular_nome and j.titular_doc)}


@app.get('/me/dados-bancarios')
def obter_dados_bancarios(jogador: JogadorModel = Depends(obter_usuario_atual)):
    return _dados_bancarios_dict(jogador)


@app.put('/me/dados-bancarios')
def salvar_dados_bancarios(body: DadosBancariosBody,
                           jogador: JogadorModel = Depends(obter_usuario_atual),
                           db: Session = Depends(get_db)):
    doc = body.titular_doc.replace('.', '').replace('-', '').replace('/', '').strip()
    if len(doc) not in (11, 14) or not doc.isdigit():
        raise HTTPException(400, 'CPF/CNPJ do titular invalido')
    banco = body.banco_codigo.strip()
    if not banco.isdigit() or len(banco) > 3:
        raise HTTPException(400, 'Codigo do banco invalido (3 digitos, ex: 260)')
    agencia = body.agencia.strip().replace('-', '')
    conta = body.conta.strip()
    if not agencia or len(agencia) > 4:
        raise HTTPException(400, 'Agencia invalida (max 4 digitos, sem digito verificador)')
    if not conta or len(conta) > 13:
        raise HTTPException(400, 'Conta invalida (max 13 caracteres, com digito)')
    if body.tipo_conta not in ('CHECKING', 'SAVINGS', 'PAYMENT'):
        raise HTTPException(400, 'Tipo de conta deve ser CHECKING, SAVINGS ou PAYMENT')
    if not body.titular_nome.strip():
        raise HTTPException(400, 'Nome do titular obrigatorio')
    if not body.chave_pix.strip():
        raise HTTPException(400, 'Chave PIX obrigatoria')
    jogador.banco_codigo = banco.zfill(3)
    jogador.agencia = agencia
    jogador.conta = conta
    jogador.tipo_conta = body.tipo_conta
    jogador.titular_nome = body.titular_nome.strip()
    jogador.titular_doc = doc
    jogador.chave_pix = body.chave_pix.strip()
    db.commit()
    return {'message': 'Dados bancarios salvos com sucesso.'}


# ====================== SAQUES (manuais, pagos pelo admin via Cora) ======================
SAQUE_MINIMO = float(os.environ.get('SAQUE_MINIMO', '5.0'))
TIPOS_CHAVE_PIX = {'cpf', 'email', 'telefone', 'aleatoria'}


class SolicitarSaqueBody(BaseModel):
    valor: float
    chave_pix: Optional[str] = None
    tipo_chave: str = 'cpf'


class ProcessarSaqueBody(BaseModel):
    status: str  # pago | rejeitado


def _saque_dict(s: SaqueRequisicaoModel) -> dict:
    j = s.jogador
    return {'id': s.id, 'jogador_id': s.jogador_id,
            'jogador_nick': j.nick if j else None,
            'valor': s.valor, 'chave_pix': s.chave_pix, 'tipo_chave': s.tipo_chave,
            'status': s.status, 'cora_transfer_id': s.cora_transfer_id,
            'banco_codigo': j.banco_codigo if j else None,
            'agencia': j.agencia if j else None,
            'conta': j.conta if j else None,
            'titular_nome': j.titular_nome if j else None,
            'criado_em': s.criado_em.strftime('%d/%m/%Y %H:%M') if s.criado_em else None}


@app.post('/saques/solicitar')
def solicitar_saque(body: SolicitarSaqueBody,
                    jogador: JogadorModel = Depends(obter_usuario_atual),
                    db: Session = Depends(get_db)):
    if body.valor < SAQUE_MINIMO:
        raise HTTPException(400, f'Saque minimo: R$ {SAQUE_MINIMO:.2f}')
    if body.valor > jogador.saldo:
        raise HTTPException(400, 'Saldo insuficiente')
    if not (jogador.banco_codigo and jogador.agencia and jogador.conta
            and jogador.titular_nome and jogador.titular_doc):
        raise HTTPException(400, 'Cadastre seus dados bancarios antes de solicitar o saque.')
    chave = (body.chave_pix or jogador.chave_pix or '').strip()
    if not chave or len(chave) > 140:
        raise HTTPException(400, 'Chave PIX invalida')
    if body.tipo_chave not in TIPOS_CHAVE_PIX:
        raise HTTPException(400, "Tipo de chave deve ser: cpf, email, telefone ou aleatoria")
    pendente = db.scalar(select(SaqueRequisicaoModel).where(
        SaqueRequisicaoModel.jogador_id == jogador.id,
        SaqueRequisicaoModel.status == 'pendente'))
    if pendente:
        raise HTTPException(400, 'Voce ja tem um saque pendente. Aguarde o processamento.')
    # Debita na solicitacao (reserva) para impedir gasto duplo do saldo
    jogador.saldo -= body.valor
    saque = SaqueRequisicaoModel(jogador_id=jogador.id, valor=body.valor,
                                 chave_pix=chave, tipo_chave=body.tipo_chave, status='pendente')
    db.add(saque)
    db.commit()
    db.refresh(saque)
    return {'message': f'Saque de R$ {body.valor:.2f} solicitado. O valor foi reservado e sera pago via PIX.',
            'id': saque.id, 'saldo_restante': jogador.saldo}


@app.get('/saques/meus')
def meus_saques(jogador: JogadorModel = Depends(obter_usuario_atual), db: Session = Depends(get_db)):
    saques = db.scalars(select(SaqueRequisicaoModel)
                        .where(SaqueRequisicaoModel.jogador_id == jogador.id)
                        .order_by(SaqueRequisicaoModel.id.desc())).all()
    return [_saque_dict(s) for s in saques]


@app.get('/saques/pendentes')
def saques_pendentes(_admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    saques = db.scalars(select(SaqueRequisicaoModel)
                        .where(SaqueRequisicaoModel.status.in_(['pendente', 'processando']))
                        .order_by(SaqueRequisicaoModel.id)).all()
    return [_saque_dict(s) for s in saques]


@app.post('/saques/{saque_id}/processar')
def processar_saque(saque_id: int, body: ProcessarSaqueBody,
                    _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    if body.status not in ('pago', 'rejeitado'):
        raise HTTPException(400, "Status deve ser 'pago' ou 'rejeitado'")
    saque = db.scalar(select(SaqueRequisicaoModel).where(SaqueRequisicaoModel.id == saque_id))
    if not saque:
        raise HTTPException(404, 'Saque nao encontrado')
    if saque.status not in ('pendente', 'processando'):
        raise HTTPException(400, 'Saque ja processado')
    saque.status = body.status
    from models import utcnow
    saque.processado_em = utcnow()
    if body.status == 'rejeitado':
        jog = db.scalar(select(JogadorModel).where(JogadorModel.id == saque.jogador_id))
        if jog:
            jog.saldo += saque.valor  # devolve a reserva
    db.commit()
    return {'message': f'Saque {saque_id} marcado como {body.status}.'}


@app.post('/saques/{saque_id}/pagar-cora')
async def pagar_saque_via_cora(saque_id: int,
                               _admin: JogadorModel = Depends(require_admin),
                               db: Session = Depends(get_db)):
    """Inicia a transferencia na Cora. O admin so precisa aprovar no app da Cora."""
    from cora_pix import cora_iniciar_transferencia
    saque = db.scalar(select(SaqueRequisicaoModel).where(SaqueRequisicaoModel.id == saque_id))
    if not saque:
        raise HTTPException(404, 'Saque nao encontrado')
    if saque.status not in ('pendente', 'processando'):
        raise HTTPException(400, 'Saque ja processado')
    if saque.status == 'processando' and saque.cora_transfer_id:
        return {'message': 'Transferencia ja iniciada. Aprove no app da Cora.',
                'transfer_id': saque.cora_transfer_id}
    jog = db.scalar(select(JogadorModel).where(JogadorModel.id == saque.jogador_id))
    if not jog or not (jog.banco_codigo and jog.agencia and jog.conta
                       and jog.titular_nome and jog.titular_doc):
        raise HTTPException(400, 'Jogador sem dados bancarios completos. Pague manualmente pela chave PIX.')
    destination = {
        'bank_code': jog.banco_codigo,
        'branch_number': jog.agencia,
        'account_number': jog.conta,
        'account_type': jog.tipo_conta or 'CHECKING',
        'holder': {'name': jog.titular_nome,
                   'document': {'identity': jog.titular_doc,
                                'type': 'CPF' if len(jog.titular_doc) == 11 else 'CNPJ'}},
    }
    data = await cora_iniciar_transferencia(destination, int(round(saque.valor * 100)),
                                            code=f'SAQ-{saque.id}',
                                            description=f'Saque Camp FreeFire - {jog.nick}')
    saque.cora_transfer_id = data.get('id')
    saque.status = 'processando'
    db.commit()
    return {'message': 'Transferencia iniciada! Abra o app da Cora e aprove o pagamento.',
            'transfer_id': saque.cora_transfer_id, 'status_cora': data.get('status')}


@app.post('/saques/{saque_id}/conferir-cora')
async def conferir_saque_cora(saque_id: int,
                              _admin: JogadorModel = Depends(require_admin),
                              db: Session = Depends(get_db)):
    """Consulta o status da transferencia na Cora e atualiza o saque."""
    from cora_pix import cora_consultar_transferencia, TRANSFER_DONE, TRANSFER_FAIL
    saque = db.scalar(select(SaqueRequisicaoModel).where(SaqueRequisicaoModel.id == saque_id))
    if not saque:
        raise HTTPException(404, 'Saque nao encontrado')
    if saque.status == 'pago':
        return {'status': 'pago'}
    if not saque.cora_transfer_id:
        raise HTTPException(400, 'Saque sem transferencia iniciada')
    data = await cora_consultar_transferencia(saque.cora_transfer_id)
    status_cora = (data.get('status') or '').upper()
    from models import utcnow
    if status_cora in TRANSFER_DONE:
        saque.status = 'pago'
        saque.processado_em = utcnow()
        db.commit()
        return {'status': 'pago', 'status_cora': status_cora}
    if status_cora in TRANSFER_FAIL:
        jog = db.scalar(select(JogadorModel).where(JogadorModel.id == saque.jogador_id))
        if jog:
            jog.saldo += saque.valor
        saque.status = 'rejeitado'
        saque.processado_em = utcnow()
        db.commit()
        return {'status': 'rejeitado', 'status_cora': status_cora,
                'message': 'Transferencia cancelada/falhou na Cora. Valor devolvido ao jogador.'}
    return {'status': saque.status, 'status_cora': status_cora,
            'message': 'Aguardando aprovacao/processamento na Cora.'}


# ====================== OCR + AGENTE IA ======================
@app.post('/ocr/resultado')
async def ocr_resultado(numero_queda: int = Form(...), imagem: UploadFile = File(...),
                        _admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    conteudo = await imagem.read()
    if len(conteudo) > 8 * 1024 * 1024:
        raise HTTPException(413, 'Imagem muito grande (max 8 MB)')
    img_b64 = base64.b64encode(conteudo).decode('utf-8')
    mime = imagem.content_type or 'image/png'
    jogadores = db.scalars(select(JogadorModel)).all()
    lista_nicks = ', '.join(j.nick for j in jogadores)
    prompt = ('Analise este print de placar do Free Fire. '
              f'Jogadores cadastrados: {lista_nicks}. '
              'Para cada jogador no placar, retorne JSON: '
              '[{"nick_detectado": str, "nick_cadastrado": str_ou_null, "colocacao": int, "abates": int}]. '
              'Retorne APENAS o JSON.')
    texto = await gemini_generate([{'inline_data': {'mime_type': mime, 'data': img_b64}},
                                   {'text': prompt}])
    try:
        dados_ocr = extrair_json(texto)
    except Exception:
        raise HTTPException(422, 'Gemini nao retornou JSON valido.')
    resultados = []
    for item in dados_ocr:
        nick_cad = item.get('nick_cadastrado')
        jog = db.scalar(select(JogadorModel).where(JogadorModel.nick == nick_cad)) if nick_cad else None
        resultados.append({
            'jogador_id': jog.id if jog else None,
            'jogador_nick': nick_cad or item.get('nick_detectado'),
            'colocacao': item.get('colocacao') or 52,
            'abates': item.get('abates') or 0,
        })
    return {'resultados': resultados}


@app.post('/agente/comando')
async def agente_comando(body: ComandoAgenteBody,
                         admin: JogadorModel = Depends(require_admin), db: Session = Depends(get_db)):
    jogadores = db.scalars(select(JogadorModel)).all()
    jogadores_info = json.dumps([{'id': j.id, 'nick': j.nick, 'nome': j.nome, 'saldo': j.saldo}
                                 for j in jogadores], ensure_ascii=False)
    prompt = (f'Voce gerencia o campeonato de Free Fire. Jogadores: {jogadores_info}. '
              f'Comando do admin: "{body.comando}". '
              'Retorne JSON: {"acao": str, "dados": dict, "resposta_texto": str}. '
              'Acoes possiveis: listar_jogadores, cadastrar_jogador, liberar_sala, lancar_resultado, informacao. '
              'Para cadastrar_jogador dados={nome,nick}. Para liberar_sala dados={numero_queda,sala_id,sala_senha}. '
              'Para lancar_resultado dados={numero_queda, resultados:[{jogador_id,colocacao,abates}]}. '
              'Retorne APENAS o JSON.')
    texto = await gemini_generate([{'text': prompt}])
    try:
        r_ia = extrair_json(texto)
    except Exception:
        return {'resposta': f'Comando recebido mas nao processado automaticamente: {body.comando}'}
    acao = r_ia.get('acao', 'desconhecido')
    dados = r_ia.get('dados', {})
    if acao == 'listar_jogadores':
        nomes = ', '.join(f"{j.nick} (R$ {j.saldo:.2f})" for j in jogadores)
        return {'resposta': f'Jogadores: {nomes}'}
    if acao == 'cadastrar_jogador':
        nome, nick = dados.get('nome'), dados.get('nick')
        if not nome or not nick:
            return {'resposta': 'Informe nome e nick para cadastrar.'}
        if db.scalar(select(JogadorModel).where(JogadorModel.nick == nick)):
            return {'resposta': f'Nick {nick} ja existe.'}
        db.add(JogadorModel(nome=nome, nick=nick, senha_hash=None, saldo=0.0, is_admin=False))
        db.commit()
        return {'resposta': f'Jogador {nick} ({nome}) cadastrado! Senha deve ser definida no primeiro acesso.'}
    if acao == 'liberar_sala':
        num, sid, ssn = dados.get('numero_queda'), dados.get('sala_id'), dados.get('sala_senha')
        if not all([num, sid, ssn]):
            return {'resposta': 'Informe queda, ID e senha da sala.'}
        queda = _get_queda(db, num)
        if not queda:
            queda = QuedaModel(numero_queda=num, status='aberta')
            db.add(queda)
            db.flush()
        queda.sala_id, queda.sala_senha = sid, ssn
        db.commit()
        return {'resposta': f'Sala queda {num}: ID={sid} | Senha={ssn}'}
    if acao == 'lancar_resultado':
        num, resultados = dados.get('numero_queda'), dados.get('resultados', [])
        if not num or not resultados:
            return {'resposta': 'Informe queda e resultados.'}
        msgs = []
        for res in resultados:
            jog = db.scalar(select(JogadorModel).where(JogadorModel.id == res.get('jogador_id')))
            if not jog:
                continue
            if db.scalar(select(ResultadoQuedaModel).where(
                    ResultadoQuedaModel.numero_queda == num,
                    ResultadoQuedaModel.jogador_id == jog.id)):
                continue
            premio = calcular_premio(res.get('colocacao', 52), res.get('abates', 0))
            db.add(ResultadoQuedaModel(jogador_id=jog.id, numero_queda=num,
                                       colocacao=res.get('colocacao', 52),
                                       abates=res.get('abates', 0), premio=premio))
            jog.saldo += premio
            msgs.append(f"{jog.nick}: {res.get('colocacao')}o, {res.get('abates')} kills, R$ {premio:.2f}")
        db.commit()
        return {'resposta': f'Queda {num}: ' + (', '.join(msgs) if msgs else 'Nenhum novo resultado.')}
    return {'resposta': r_ia.get('resposta_texto', 'Processado.')}
