import { useState } from "react";
import { QrCode, ChevronLeft } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || "https://campfreefire-production.up.railway.app";

interface Props { jogadorId: number; }

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").substring(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
}

export default function PixDeposito({ jogadorId }: Props) {
  const [valor, setValor] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrError, setQrError] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [erro, setErro] = useState("");
  const [copied, setCopied] = useState(false);

  const cpfDigits = cpf.replace(/\D/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setQrCode(""); setQrError(false); setInvoiceId(""); setCopied(false);
    const parsedValor = parseFloat(valor.replace(",", "."));
    if (!valor || isNaN(parsedValor) || parsedValor < 1) { setErro("Valor mínimo: R$ 1,00"); return; }
    if (cpfDigits.length !== 11) { setErro("CPF inválido — informe 11 dígitos"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/pix/criar-cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jogador_id: jogadorId, valor: parsedValor, cpf: cpfDigits }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Erro ao gerar cobrança");
      setQrCode(data.qr_code || "");
      setQrError(false);
      setInvoiceId(data.invoice_id || "");
    } catch (err: any) {
      setErro(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = async () => {
    if (!qrCode) return;
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = qrCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const qrImageUrl = qrCode
    ? "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrCode) + "&size=220x220&margin=8"
    : "";

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Depositar via PIX</p>

      {!qrCode ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Quick value buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 10, 20, 50].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setValor(String(v))}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  valor === String(v)
                    ? "bg-primary border-primary text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                R${v}
              </button>
            ))}
          </div>

          {/* Manual value input — type text to avoid browser locking 0 */}
          <input
            type="text"
            inputMode="decimal"
            placeholder="Outro valor (ex: 15,00)"
            value={valor}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9.,]/g, "");
              setValor(raw);
            }}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:text-zinc-600"
          />

          {/* CPF input */}
          <input
            type="text"
            placeholder="CPF (000.000.000-00)"
            value={cpf}
            inputMode="numeric"
            onChange={e => setCpf(formatCpf(e.target.value))}
            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-600"
          />

          {erro && <p className="text-xs text-rose-400 font-semibold">{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando PIX...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                Gerar QR Code PIX
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400 text-center">Escaneie o QR code ou copie o código:</p>

          {/* QR Image */}
          <div className="flex justify-center">
            <img
              src={qrImageUrl}
              alt="QR Code PIX"
              className="w-[220px] h-[220px] rounded-xl bg-white p-1"
              onError={() => setQrError(true)}
            />
          </div>

          {qrError && (
            <p className="text-xs text-amber-400 text-center font-semibold">
              ⚠️ Imagem não carregou. Copie o código abaixo.
            </p>
          )}

          {/* EMV code */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[10px] font-mono text-zinc-500 break-all leading-relaxed">
            {qrCode}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!qrCode}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              copied
                ? "bg-emerald-500 text-white"
                : "bg-orange-500 hover:bg-orange-400 text-white"
            }`}
          >
            {copied ? "✅ Código copiado!" : "📋 Copiar código PIX"}
          </button>

          {/* Back button */}
          <button
            onClick={() => { setQrCode(""); setQrError(false); setErro(""); }}
            className="w-full py-2 rounded-xl bg-transparent border border-zinc-800 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Novo depósito
          </button>
        </div>
      )}
    </div>
  );
}
