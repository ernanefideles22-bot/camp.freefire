CREATE TABLE IF NOT EXISTS torneios_fusao (
  id BIGSERIAL PRIMARY KEY, nome VARCHAR NOT NULL DEFAULT 'Torneio Fusão Suprema', subtitulo VARCHAR NOT NULL DEFAULT 'Sobreviva no BR. Domine no CS. Conquiste a Coroa.', descricao TEXT,
  status VARCHAR NOT NULL DEFAULT 'inscricao', tamanho_equipe INTEGER NOT NULL DEFAULT 2, min_equipes INTEGER NOT NULL DEFAULT 2, max_equipes INTEGER, max_reservas INTEGER DEFAULT 2,
  taxa_inscricao DOUBLE PRECISION NOT NULL DEFAULT 3, data_br VARCHAR, data_cs VARCHAR, rodadas_br INTEGER NOT NULL DEFAULT 5, classificados INTEGER NOT NULL DEFAULT 16,
  pontos_colocacao_json TEXT, pontos_abate DOUBLE PRECISION NOT NULL DEFAULT 1, desempates_json TEXT, chaveamento VARCHAR NOT NULL DEFAULT 'seed', series_json TEXT, vantagem TEXT, premios_json TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS equipes_fusao (
  id BIGSERIAL PRIMARY KEY, torneio_id BIGINT NOT NULL REFERENCES torneios_fusao(id), nome VARCHAR NOT NULL, capitao_id BIGINT NOT NULL REFERENCES jogadores(id), nome_guilda VARCHAR, logo_data TEXT, slot_br INTEGER, criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS membros_equipes_fusao (
  id BIGSERIAL PRIMARY KEY, equipe_id BIGINT NOT NULL REFERENCES equipes_fusao(id), jogador_id BIGINT NOT NULL REFERENCES jogadores(id), reserva BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS resultados_fusao_br (
  id BIGSERIAL PRIMARY KEY, torneio_id BIGINT NOT NULL REFERENCES torneios_fusao(id), equipe_id BIGINT NOT NULL REFERENCES equipes_fusao(id), ordem INTEGER NOT NULL, colocacao INTEGER NOT NULL, abates INTEGER NOT NULL DEFAULT 0, criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS confrontos_fusao_cs (
  id BIGSERIAL PRIMARY KEY, torneio_id BIGINT NOT NULL REFERENCES torneios_fusao(id), fase INTEGER NOT NULL, ordem INTEGER NOT NULL, serie_md INTEGER NOT NULL DEFAULT 3,
  equipe_a_id BIGINT REFERENCES equipes_fusao(id), equipe_b_id BIGINT REFERENCES equipes_fusao(id), vitorias_a INTEGER NOT NULL DEFAULT 0, vitorias_b INTEGER NOT NULL DEFAULT 0,
  vencedor_id BIGINT REFERENCES equipes_fusao(id), status VARCHAR NOT NULL DEFAULT 'aguardando'
);
CREATE TABLE IF NOT EXISTS pagamentos_fusao (
  id BIGSERIAL PRIMARY KEY, torneio_id BIGINT NOT NULL REFERENCES torneios_fusao(id), equipe_id BIGINT NOT NULL REFERENCES equipes_fusao(id), colocacao_final INTEGER NOT NULL,
  valor DOUBLE PRECISION NOT NULL, status VARCHAR NOT NULL DEFAULT 'pendente', criado_em TIMESTAMPTZ DEFAULT NOW(), liberado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_torneios_fusao_status ON torneios_fusao(status);
CREATE INDEX IF NOT EXISTS ix_equipes_fusao_torneio_id ON equipes_fusao(torneio_id);
CREATE INDEX IF NOT EXISTS ix_membros_equipes_fusao_equipe_id ON membros_equipes_fusao(equipe_id);
CREATE INDEX IF NOT EXISTS ix_resultados_fusao_br_torneio_id ON resultados_fusao_br(torneio_id);
CREATE INDEX IF NOT EXISTS ix_confrontos_fusao_cs_torneio_id ON confrontos_fusao_cs(torneio_id);
CREATE INDEX IF NOT EXISTS ix_pagamentos_fusao_torneio_id ON pagamentos_fusao(torneio_id);
