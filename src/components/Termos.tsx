import { X } from 'lucide-react';

export const TERMOS_VERSAO = '1.0';

export default function Termos({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="ff-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-gradient-neon mb-1">Termos de Uso e Politica de Privacidade</h2>
        <p className="text-[11px] text-amber-400/90 mb-5">
          Rascunho (versao {TERMOS_VERSAO}) — deve ser revisado por um advogado antes do uso em producao.
        </p>

        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <section>
            <h3 className="font-bold text-white">1. Sobre a plataforma</h3>
            <p>O Flow Fire Champions organiza campeonatos de Free Fire baseados em habilidade, com
            inscricoes pagas e premiacao em dinheiro. Ao usar a plataforma voce concorda com estes termos.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">2. Idade minima (18+)</h3>
            <p>O uso e restrito a maiores de 18 anos. Ao se cadastrar voce declara, sob sua responsabilidade,
            ter 18 anos ou mais. Contas de menores de idade serao encerradas e os valores tratados conforme a lei.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">3. Conta e responsabilidade</h3>
            <p>Voce e responsavel por suas credenciais e por toda atividade na sua conta. E proibido criar
            multiplas contas, fraudar resultados, usar contas de terceiros ou qualquer pratica de lavagem de dinheiro.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">4. Depositos, premios e saques</h3>
            <p>Depositos sao feitos via PIX. Apenas valores ganhos como premio sao sacaveis; valores depositados
            servem para pagar inscricoes. Por seguranca, o saque so e enviado para uma chave PIX cujo titular
            seja o mesmo CPF da conta. A taxa de inscricao por queda e informada no app.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">5. Regras do campeonato</h3>
            <p>A inscricao debita o valor do seu saldo. Resultados (colocacao e abates) sao lancados pela
            organizacao e os premios sao creditados conforme a tabela vigente. Quedas canceladas geram reembolso.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">6. Jogo responsavel</h3>
            <p>Jogue com moderacao. Estabeleca limites de tempo e de gastos. Se sentir que o jogo deixou de ser
            diversao, procure ajuda. Voce pode solicitar a <strong>autoexclusao</strong> (suspensao da sua conta)
            a qualquer momento pelo suporte; enquanto durar, voce nao podera se inscrever em quedas.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">7. Privacidade (LGPD)</h3>
            <p>Coletamos nome, nick, e-mail (se login Google), CPF e dados de chave PIX para identificacao,
            pagamentos e prevencao a fraude. Os dados sao usados apenas para operar a plataforma e cumprir
            obrigacoes legais, e nao sao vendidos. Voce pode solicitar acesso, correcao ou exclusao dos seus
            dados pelo suporte, observadas as retencoes exigidas por lei.</p>
          </section>
          <section>
            <h3 className="font-bold text-white">8. Limitacao e alteracoes</h3>
            <p>A plataforma e fornecida "como esta". Podemos alterar estes termos; mudancas relevantes exigirao
            novo aceite. O foro e o do domicilio do usuario, conforme a legislacao aplicavel.</p>
          </section>
          <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800">
            Documento modelo, nao constitui aconselhamento juridico. Revise com um advogado antes de operar
            com dinheiro real de terceiros.
          </p>
        </div>
      </div>
    </div>
  );
}
