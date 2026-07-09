"""Modelos ORM (SQLAlchemy 2.x, estilo Mapped/mapped_column)."""
from datetime import datetime, timezone, date
from typing import Optional, List

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JogadorModel(Base):
    __tablename__ = 'jogadores'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    nick: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    senha_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # CPF do titular (capturado no 1o deposito). Usado para travar o saque na
    # chave PIX do proprio dono. Sem CPF, sem saque.
    cpf: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    # Login social (opcional). google_sub e o id estavel do usuario no Google.
    google_sub: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    saldo: Mapped[float] = mapped_column(Float, default=0.0)
    # Parcela SACAVEL do saldo (apenas premios). Depositos NAO entram aqui:
    # so se pode sacar o que foi ganho jogando -> mata o passthrough deposito->saque.
    # Invariante: saldo_sacavel <= saldo, sempre.
    saldo_sacavel: Mapped[float] = mapped_column(Float, default=0.0)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Aceite de termos + maioridade (registro legal do consentimento)
    aceitou_termos: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmou_idade: Mapped[bool] = mapped_column(Boolean, default=False)
    termos_versao: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    termos_aceito_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    data_nascimento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # --- Sistema de convites (indicacao) ---
    codigo_convite: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    indicado_por: Mapped[Optional[int]] = mapped_column(ForeignKey('jogadores.id'), nullable=True, index=True)
    convite_pago: Mapped[bool] = mapped_column(Boolean, default=False)
    registro_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ultimo_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    # Dados bancarios para saque via API Cora (transferencia exige conta, nao chave PIX)
    banco_codigo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    agencia: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    conta: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tipo_conta: Mapped[Optional[str]] = mapped_column(String, nullable=True, default='CHECKING')
    titular_nome: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    titular_doc: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    chave_pix: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    asaas_customer_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)  # soft delete: False = jogador excluido/bloqueado pelo admin
    inscricoes: Mapped[List['InscricaoModel']] = relationship(back_populates='jogador')
    resultados: Mapped[List['ResultadoQuedaModel']] = relationship(back_populates='jogador')
    depositos: Mapped[List['DepositoRequisicaoModel']] = relationship(back_populates='jogador')
    cobrancas_pix: Mapped[List['CobrancaPixModel']] = relationship(back_populates='jogador')
    saques: Mapped[List['SaqueRequisicaoModel']] = relationship(back_populates='jogador')
    transacoes: Mapped[List['TransacaoModel']] = relationship(back_populates='jogador')


class QuedaModel(Base):
    __tablename__ = 'quedas'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    numero_queda: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    sala_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala_senha: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default='aberta')
    horario: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    inscricoes: Mapped[List['InscricaoModel']] = relationship(back_populates='queda')
    resultados: Mapped[List['ResultadoQuedaModel']] = relationship(back_populates='queda')


class InscricaoModel(Base):
    __tablename__ = 'inscricoes'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    numero_queda: Mapped[int] = mapped_column(ForeignKey('quedas.numero_queda'), nullable=False)
    data_inscricao: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='inscricoes')
    queda: Mapped['QuedaModel'] = relationship(back_populates='inscricoes')


class ResultadoQuedaModel(Base):
    __tablename__ = 'resultados_queda'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    numero_queda: Mapped[int] = mapped_column(ForeignKey('quedas.numero_queda'), nullable=False)
    colocacao: Mapped[int] = mapped_column(Integer, nullable=False)
    abates: Mapped[int] = mapped_column(Integer, default=0)
    premio: Mapped[float] = mapped_column(Float, default=0.0)
    suspeito: Mapped[bool] = mapped_column(Boolean, default=False)
    revisado: Mapped[bool] = mapped_column(Boolean, default=False)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='resultados')
    queda: Mapped['QuedaModel'] = relationship(back_populates='resultados')


class DepositoRequisicaoModel(Base):
    __tablename__ = 'depositos_requisicao'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pendente')
    data_hora: Mapped[str] = mapped_column(String, default=lambda: utcnow().strftime('%d/%m/%Y %H:%M'))
    # Auditoria do credito manual do admin (substitui o antigo /depositos/solicitar).
    motivo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    criado_por_admin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='depositos')


class SaqueRequisicaoModel(Base):
    """Solicitacao de saque. O valor e debitado do saldo na criacao (reserva);
    se rejeitada, o valor e devolvido."""
    __tablename__ = 'saques_requisicao'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    chave_pix: Mapped[str] = mapped_column(String, nullable=False)
    tipo_chave: Mapped[str] = mapped_column(String, nullable=False, default='cpf')  # cpf|email|telefone|aleatoria
    status: Mapped[str] = mapped_column(String, default='pendente', index=True)  # pendente|processando|pago|rejeitado
    cora_transfer_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    titular_chave: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # nome do dono da chave (Asaas)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    processado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='saques')


class CobrancaPixModel(Base):
    """Cobranca PIX gerada na Cora. Necessaria para conciliar o webhook."""
    __tablename__ = 'cobrancas_pix'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    invoice_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pendente', index=True)  # pendente|pago|cancelado
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    pago_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='cobrancas_pix')


class TransacaoModel(Base):
    """Ledger APPEND-ONLY de todas as mutacoes de saldo. Nunca e editado nem
    apagado pelo codigo. E a fonte de auditoria/conciliacao do dinheiro."""
    __tablename__ = 'transacoes'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String, nullable=False, index=True)
    valor: Mapped[float] = mapped_column(Float, nullable=False)          # delta com sinal (+ credito, - debito)
    saldo_antes: Mapped[float] = mapped_column(Float, nullable=False)
    saldo_depois: Mapped[float] = mapped_column(Float, nullable=False)
    sacavel_antes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sacavel_depois: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ref: Mapped[Optional[str]] = mapped_column(String, nullable=True)    # ex: 'queda:5', 'saque:12', 'cobranca:xxx'
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    jogador: Mapped['JogadorModel'] = relationship(back_populates='transacoes')


def registrar_transacao(db, jogador: 'JogadorModel', *, tipo: str,
                        delta_saldo: float = 0.0, delta_sacavel: float = 0.0,
                        ref: str = '') -> 'TransacaoModel':
    """Aplica a mutacao de saldo E grava o lancamento no ledger, de forma atomica.
    UNICO ponto autorizado a mexer em saldo/saldo_sacavel. Mantem a invariante
    0 <= saldo_sacavel <= saldo. Nao faz commit (o chamador commita)."""
    saldo_antes = jogador.saldo
    sacavel_antes = jogador.saldo_sacavel
    jogador.saldo = round(jogador.saldo + delta_saldo, 2)
    jogador.saldo_sacavel = round(jogador.saldo_sacavel + delta_sacavel, 2)
    if jogador.saldo_sacavel > jogador.saldo:
        jogador.saldo_sacavel = jogador.saldo
    if jogador.saldo_sacavel < 0:
        jogador.saldo_sacavel = 0.0
    tx = TransacaoModel(
        jogador_id=jogador.id, tipo=tipo, valor=round(delta_saldo, 2),
        saldo_antes=round(saldo_antes, 2), saldo_depois=jogador.saldo,
        sacavel_antes=round(sacavel_antes, 2), sacavel_depois=jogador.saldo_sacavel,
        ref=ref or None,
    )
    db.add(tx)
    return tx


class AppConfigModel(Base):
    """Config global (linha unica, id=1).
    ranking_desde_queda: so contam no ranking as quedas com numero >= este valor
    (usado para o reset semanal da liga de pontos)."""
    __tablename__ = 'app_config'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    ranking_desde_queda: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


# ====================== QUEDA BONUS (evento promocional, melhor de 3) ======================
# Tudo isolado do fluxo de dinheiro (pote/rake). NAO usa InscricaoModel nem
# ResultadoQuedaModel -> logo NAO entra no ranking semanal nem na premiacao proporcional.
class EventoBonusModel(Base):
    """Serie de 3 quedas, entrada gratis, premio fixo da casa ao top 5."""
    __tablename__ = 'eventos_bonus'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    # inscricao -> em_andamento -> aguardando_revisao -> pago | cancelado
    status: Mapped[str] = mapped_column(String, default='inscricao', index=True)
    min_jogadores: Mapped[int] = mapped_column(Integer, default=20)
    premio_total: Mapped[float] = mapped_column(Float, default=100.0)
    # Data/hora do evento (texto livre, ex: '15/07 20:00') e premio por colocacao (1o..5o),
    # configuraveis pelo admin. Default = tabela padrao (50/20/15/10/5 = 100).
    data_hora: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # JSON com os premios absolutos por colocacao (qualquer nº de posicoes),
    # ex: "[50,20,15,10,5]" (top 5) ou "[60,40]" (top 2). Vazio = padrao 50/20/15/10/5.
    premios_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # Credenciais de sala de cada uma das 3 quedas (preenchidas pelo admin)
    sala1_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala1_senha: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala1_horario: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala2_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala2_senha: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala2_horario: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala3_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala3_senha: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala3_horario: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class InscricaoBonusModel(Base):
    """Inscricao GRATIS num evento bonus. Guarda CPF/IP/device para anti-farm."""
    __tablename__ = 'inscricoes_bonus'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evento_id: Mapped[int] = mapped_column(ForeignKey('eventos_bonus.id'), nullable=False, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False, index=True)
    cpf: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    registro_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    device_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ResultadoBonusModel(Base):
    """Resultado de UMA das 3 quedas do evento (ordem 1..3). Fora do ranking semanal."""
    __tablename__ = 'resultados_bonus'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evento_id: Mapped[int] = mapped_column(ForeignKey('eventos_bonus.id'), nullable=False, index=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2 ou 3
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False, index=True)
    colocacao: Mapped[int] = mapped_column(Integer, nullable=False)
    abates: Mapped[int] = mapped_column(Integer, default=0)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PagamentoBonusModel(Base):
    """Premio apurado do top 5. Fica RETIDO (pendente) ate o admin liberar -> so ai
    o dinheiro entra no ledger e vira sacavel."""
    __tablename__ = 'pagamentos_bonus'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evento_id: Mapped[int] = mapped_column(ForeignKey('eventos_bonus.id'), nullable=False, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False, index=True)
    colocacao_final: Mapped[int] = mapped_column(Integer, nullable=False)
    pontos_total: Mapped[int] = mapped_column(Integer, default=0)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pendente', index=True)  # pendente|liberado|rejeitado
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    liberado_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
