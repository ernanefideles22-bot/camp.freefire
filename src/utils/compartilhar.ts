export type CategoriaCampeonato = 'bonus' | 'individual' | 'equipes' | 'fusao';

export function linkCampeonato(categoria: CategoriaCampeonato, eventoId: number) {
  return `${window.location.origin}/#campeonatos/${categoria}/${eventoId}`;
}

export async function compartilharCampeonato(nome: string, categoria: CategoriaCampeonato, eventoId: number) {
  const url = linkCampeonato(categoria, eventoId);
  const texto = `Inscrições abertas para ${nome} no FlowFire Champions. Entre na arena e garanta sua vaga.`;
  if (navigator.share) {
    await navigator.share({ title: nome, text: texto, url });
    return;
  }
  await navigator.clipboard.writeText(url);
}
