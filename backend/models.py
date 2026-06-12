"""Modelos ORM (SQLAlchemy 2.x, estilo Mapped/mapped_column)."""
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime
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
    saldo: Mapped[float] = mapped_column(Float, default=0.0)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    inscricoes: Mapped[List['InscricaoModel']] = relationship(back_populates='jogador')
    resultados: Mapped[List['ResultadoQuedaModel']] = relationship(back_populates='jogador')
    depositos: Mapped[List['DepositoRequisicaoModel']] = relationship(back_populates='jogador')
    cobrancas_pix: Mapped[List['CobrancaPixModel']] = relationship(back_populates='jogador')


class QuedaModel(Base):
    __tablename__ = 'quedas'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    numero_queda: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    sala_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sala_senha: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default='aberta')
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
    jogador: Mapped['JogadorModel'] = relationship(back_populates='resultados')
    queda: Mapped['QuedaModel'] = relationship(back_populates='resultados')


class DepositoRequisicaoModel(Base):
    __tablename__ = 'depositos_requisicao'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jogador_id: Mapped[int] = mapped_column(ForeignKey('jogadores.id'), nullable=False)
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pendente')
    data_hora: Mapped[str] = mapped_column(String, default=lambda: utcnow().strftime('%d/%m/%Y %H:%M'))
    jogador: Mapped['JogadorModel'] = relationship(back_populates='depositos')


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
