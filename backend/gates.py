"""Gates de risco/compliance do Camp Free Fire.

Tres controles que faltavam, isolados aqui para acoplar pouco ao resto:

  1. IDADE      -> validar_maioridade(): exige data de nascimento e >= 18 no cadastro.
  2. COLUSAO    -> avaliar_suspeitos(): marca premios de quedas suspeitas (lobby
                   pequeno demais ou jogadores no mesmo IP) e SEGURA o sacavel
                   ate revisao do admin. O passthrough deposito->saque ja era
                   barrado por saldo_sacavel; isto fecha o buraco da COLUSAO
                   (chip-dumping: A perde de proposito pra B).
  3. MED/HOLD   -> checar_hold_saque(): segura o saque enquanto houver deposito
                   PIX dentro da janela de risco de devolucao (MED). Sem isto,
                   o golpe e: depositar -> ganhar -> sacar -> pedir MED do deposito.

Tudo configuravel por env var. Nada aqui faz commit: quem chama commita.
"""
import os
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models import (JogadorModel, InscricaoModel, ResultadoQuedaModel,
                    CobrancaPixModel, registrar_transacao)

# ====================== CONFIG (env) ======================
IDADE_MINIMA = int(os.environ.get('IDADE_MINIMA', '18'))
# Quedas com menos participantes pagantes que isto NAO geram saldo sacavel
# automaticamente (premio entra so como saldo; sacavel fica retido p/ revisao).
MIN_PARTICIPANTES_SACAVEL = int(os.environ.get('GATE_MIN_PARTICIPANTES', '6'))
# Janela (dias) em que um deposito PIX ainda pode ser revertido por MED/chargeback.
# Enquanto durar, o valor depositado nao pode ser sacado.
MED_HOLD_DIAS = int(os.environ.get('MED_HOLD_DIAS', '7'))

_EPS = 0.001  # tolerancia p/ comparacao de floats de dinheiro


# ====================== 1. IDADE ======================
def calcular_idade(nascimento: date, hoje: Optional[date] = None) -> int:
    hoje = hoje or datetime.now(timezone.utc).date()
    return hoje.year - nascimento.year - (
        (hoje.month, hoje.day) < (nascimento.month, nascimento.day))


def validar_maioridade(data_nascimento: Optional[str]) -> date:
    """Parseia 'YYYY-MM-DD' e exige idade >= IDADE_MINIMA.
    Retorna o date parseado (para persistir). Levanta 400 se invalido/menor.

    OBS: isto e AUTODECLARACAO server-side — muito melhor que um checkbox, mas
    NAO e KYC. Verificacao real (CPF<->nome<->nascimento) exige provedor pago
    (Serpro/Datavalid, idwall, CAF, BigDataCorp...). Ver verificar_cpf_kyc()."""
    if not data_nascimento:
        raise HTTPException(400, 'Informe sua data de nascimento (AAAA-MM-DD).')
    try:
        nasc = date.fromisoformat(data_nascimento.strip())
    except (ValueError, AttributeError):
        raise HTTPException(400, 'Data de nascimento invalida. Use o formato AAAA-MM-DD.')
    if nasc > datetime.now(timezone.utc).date():
        raise HTTPException(400, 'Data de nascimento no futuro.')
    idade = calcular_idade(nasc)
    if idade < IDADE_MINIMA:
        raise HTTPException(403, f'Voce precisa ter {IDADE_MINIMA} anos ou mais para usar a plataforma.')
    if idade > 120:
        raise HTTPException(400, 'Data de nascimento invalida.')
    return nasc


def verificar_cpf_kyc(cpf: str, nome: str, nascimento: Optional[date]) -> bool:
    """HOOK p/ KYC real (NAO implementado: exige contratar provedor + credenciais).
    Hoje retorna True (no-op) para nao bloquear o fluxo. Quando contratarem um
    provedor (ex.: Serpro Datavalid), implemente aqui a consulta CPF<->nome<->
    nascimento e retorne o resultado. Mantido como ponto unico de integracao."""
    return True


# ====================== util: IP do cliente ======================
def extrair_ip(request: Optional[Request]) -> Optional[str]:
    """IP do cliente atras do proxy da Vercel. Primeiro hop do X-Forwarded-For."""
    if request is None:
        return None
    xff = request.headers.get('x-forwarded-for') or request.headers.get('X-Forwarded-For')
    if xff:
        return xff.split(',')[0].strip()[:64] or None
    real = request.headers.get('x-real-ip')
    if real:
        return real.strip()[:64] or None
    return request.client.host if request.client else None


# ====================== 2. COLUSAO ======================
def _conflitos_de_ip(db: Session, jogador_ids: list) -> set:
    """Retorna o conjunto de jogador_ids que compartilham ultimo_ip com OUTRO
    jogador da mesma lista (sinal forte de multi-conta/colusao)."""
    if not jogador_ids:
        return set()
    rows = db.execute(
        select(JogadorModel.id, JogadorModel.ultimo_ip)
        .where(JogadorModel.id.in_(jogador_ids))
    ).all()
    por_ip: dict = {}
    for jid, ip in rows:
        if ip:
            por_ip.setdefault(ip, []).append(jid)
    suspeitos = set()
    for ip, ids in por_ip.items():
        if len(ids) > 1:
            suspeitos.update(ids)
    return suspeitos


def avaliar_suspeitos(db: Session, numero_queda: int, jogador_ids: list) -> set:
    """Decide quais premios desta queda devem ter o SACAVEL retido (suspeito).

    Regras (uniao):
      - Lobby pequeno: menos de MIN_PARTICIPANTES_SACAVEL inscritos distintos
        -> todos os premios da queda ficam retidos (lobby de chip-dumping).
      - Mesmo IP: jogadores da queda que dividem ultimo_ip entre si.

    Retorna o set de jogador_ids cujos premios NAO devem creditar sacavel agora.
    """
    inscritos = db.scalar(
        select(func.count(func.distinct(InscricaoModel.jogador_id)))
        .where(InscricaoModel.numero_queda == numero_queda)
    ) or 0

    if inscritos < MIN_PARTICIPANTES_SACAVEL:
        return set(jogador_ids)  # lobby pequeno: segura todo mundo

    return _conflitos_de_ip(db, jogador_ids)


def listar_resultados_suspeitos(db: Session) -> list:
    """Fila de revisao do admin: premios com sacavel retido e ainda nao revisados."""
    rows = db.scalars(
        select(ResultadoQuedaModel)
        .where(ResultadoQuedaModel.suspeito.is_(True),
               ResultadoQuedaModel.revisado.is_(False))
        .order_by(ResultadoQuedaModel.numero_queda.desc())
    ).all()
    out = []
    for r in rows:
        j = db.scalar(select(JogadorModel).where(JogadorModel.id == r.jogador_id))
        out.append({'resultado_id': r.id, 'numero_queda': r.numero_queda,
                    'jogador_id': r.jogador_id, 'jogador_nick': j.nick if j else None,
                    'colocacao': r.colocacao, 'abates': r.abates, 'premio': r.premio})
    return out


def liberar_resultado_sacavel(db: Session, resultado_id: int, lock_jogador) -> dict:
    """Admin aprovou: credita o sacavel retido de um resultado suspeito.
    `lock_jogador(db, jogador_id)` = a funcao de trava de linha do main.py.
    Nao faz commit (o chamador commita)."""
    r = db.scalar(select(ResultadoQuedaModel).where(ResultadoQuedaModel.id == resultado_id))
    if not r:
        raise HTTPException(404, 'Resultado nao encontrado.')
    if not r.suspeito or r.revisado:
        raise HTTPException(400, 'Resultado nao esta pendente de revisao.')
    jog = lock_jogador(db, r.jogador_id)
    if not jog:
        raise HTTPException(404, 'Jogador nao encontrado.')
    registrar_transacao(db, jog, tipo='premio_liberado', delta_sacavel=r.premio,
                        ref=f'queda:{r.numero_queda}')
    r.revisado = True
    return {'resultado_id': r.id, 'jogador_id': r.jogador_id, 'premio_liberado': r.premio}


def rejeitar_resultado_sacavel(db: Session, resultado_id: int) -> dict:
    """Admin reprovou (colusao confirmada): mantem o sacavel retido para sempre.
    So marca como revisado para sair da fila. O saldo (nao-sacavel) permanece —
    se quiser tambem estornar o saldo, faca um ajuste manual no ledger."""
    r = db.scalar(select(ResultadoQuedaModel).where(ResultadoQuedaModel.id == resultado_id))
    if not r:
        raise HTTPException(404, 'Resultado nao encontrado.')
    r.revisado = True
    return {'resultado_id': r.id, 'sacavel_liberado': False}


# ====================== 3. MED / HOLD DE SAQUE ======================
def valor_em_risco_med(db: Session, jogador_id: int):
    """(valor_em_risco, data_liberacao) dos depositos PIX ainda dentro da janela
    de MED. valor_em_risco = soma dos depositos pagos ha menos de MED_HOLD_DIAS;
    data_liberacao = quando o deposito mais antigo dentro da janela sai dela."""
    if MED_HOLD_DIAS <= 0:
        return 0.0, None
    corte = datetime.now(timezone.utc) - timedelta(days=MED_HOLD_DIAS)
    rows = db.execute(
        select(CobrancaPixModel.valor, CobrancaPixModel.pago_em)
        .where(CobrancaPixModel.jogador_id == jogador_id,
               CobrancaPixModel.status == 'pago',
               CobrancaPixModel.pago_em.is_not(None),
               CobrancaPixModel.pago_em > corte)
    ).all()
    if not rows:
        return 0.0, None
    em_risco = round(sum(v for v, _ in rows), 2)
    primeiro = min(p for _, p in rows)
    liberacao = primeiro + timedelta(days=MED_HOLD_DIAS)
    return em_risco, liberacao


def disponivel_para_saque(db: Session, jogador: JogadorModel):
    """Quanto do sacavel pode sair agora, descontando depositos ainda reversiveis.
    Retorna (disponivel, em_risco, data_liberacao)."""
    em_risco, liberacao = valor_em_risco_med(db, jogador.id)
    disponivel = max(0.0, round(jogador.saldo_sacavel - em_risco, 2))
    return disponivel, em_risco, liberacao


def checar_hold_saque(db: Session, jogador: JogadorModel, valor: float) -> None:
    """Bloqueia o saque se o valor exceder o disponivel apos descontar depositos
    dentro da janela de MED. Levanta 400 com a data de liberacao."""
    disponivel, em_risco, liberacao = disponivel_para_saque(db, jogador)
    if valor > disponivel + _EPS:
        quando = liberacao.strftime('%d/%m/%Y') if liberacao else 'em breve'
        raise HTTPException(400,
            f'Saque retido por seguranca. Voce tem R$ {em_risco:.2f} em depositos '
            f'recentes que ainda podem ser devolvidos (MED). Disponivel para saque '
            f'agora: R$ {disponivel:.2f}. O restante libera a partir de {quando}.')
