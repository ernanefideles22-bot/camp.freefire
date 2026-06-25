"""Premiacao proporcional do Flowfire — substitui o premio FIXO."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

TAXA_ENTRADA_CENTAVOS = 300
RAKE_POR_JOGADOR_CENTAVOS = 100
BOLO_POR_JOGADOR_CENTAVOS = 200
SALA_MINIMA = 12
SALA_MAXIMA = 48
LIMITE_TOP3 = 23
DIST_TOP3_BP: Tuple[int, ...] = (5000, 3000, 2000)
DIST_TOP5_BP: Tuple[int, ...] = (4000, 2500, 1800, 1000, 700)
_BP_TOTAL = 10000
assert TAXA_ENTRADA_CENTAVOS == RAKE_POR_JOGADOR_CENTAVOS + BOLO_POR_JOGADOR_CENTAVOS
assert sum(DIST_TOP3_BP) == _BP_TOTAL and sum(DIST_TOP5_BP) == _BP_TOTAL


class SalaInvalidaError(ValueError):
    """Sala fora da faixa: a queda nao inicia e nao calcula premio."""


@dataclass(frozen=True)
class Premio:
    posicao: int
    valor_centavos: int


@dataclass(frozen=True)
class Premiacao:
    n_jogadores: int
    modelo: str
    bolo_premio_centavos: int
    rake_base_centavos: int
    sobra_centavos: int
    rake_casa_centavos: int
    premios: List[Premio]

    @property
    def total_premios_centavos(self) -> int:
        return sum(p.valor_centavos for p in self.premios)


def _distribuir(bolo_centavos: int, dist_bp: Tuple[int, ...]) -> Tuple[List[int], int]:
    valores = [(bolo_centavos * bp) // _BP_TOTAL for bp in dist_bp]
    return valores, bolo_centavos - sum(valores)


def calcular_premiacao(n_jogadores: int) -> Premiacao:
    if not isinstance(n_jogadores, int) or isinstance(n_jogadores, bool):
        raise SalaInvalidaError("Numero de jogadores deve ser inteiro.")
    if n_jogadores < SALA_MINIMA:
        raise SalaInvalidaError(f"Sala insuficiente: {n_jogadores} (minimo {SALA_MINIMA}).")
    if n_jogadores > SALA_MAXIMA:
        raise SalaInvalidaError(f"Sala acima do maximo: {n_jogadores} (maximo {SALA_MAXIMA}).")
    bolo = n_jogadores * BOLO_POR_JOGADOR_CENTAVOS
    rake_base = n_jogadores * RAKE_POR_JOGADOR_CENTAVOS
    if n_jogadores <= LIMITE_TOP3:
        modelo, dist_bp = "TOP3", DIST_TOP3_BP
    else:
        modelo, dist_bp = "TOP5", DIST_TOP5_BP
    valores, sobra = _distribuir(bolo, dist_bp)
    premios = [Premio(i + 1, v) for i, v in enumerate(valores)]
    return Premiacao(n_jogadores, modelo, bolo, rake_base, sobra, rake_base + sobra, premios)


def pode_pagar(n_inscritos: int) -> bool:
    return (isinstance(n_inscritos, int) and not isinstance(n_inscritos, bool)
            and SALA_MINIMA <= n_inscritos <= SALA_MAXIMA)


def premio_centavos_por_colocacao(n_inscritos: int, colocacao: int) -> int:
    p = calcular_premiacao(n_inscritos)
    if 1 <= colocacao <= len(p.premios):
        return p.premios[colocacao - 1].valor_centavos
    return 0


def premio_reais_por_colocacao(n_inscritos: int, colocacao: int) -> float:
    return premio_centavos_por_colocacao(n_inscritos, colocacao) / 100.0
