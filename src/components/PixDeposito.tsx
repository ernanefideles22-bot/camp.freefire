import { useState } from "react";

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
    setErro(""); setQrCode("");
      setQrError(false); setInvoiceId(""); setCopied(false);
    if (!valor || parseFloat(valor) < 1) { setErro("Valor mÃÂ­nimo: R$ 1,00"); return; }
    if (cpfDigits.length !== 11) { setErro("CPF invÃÂ¡lido Ã¢ÂÂ informe 11 dÃÂ­gitos"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/pix/criar-cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jogador_id: jogadorId, valor: parseFloat(valor), cpf: cpfDigits }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Erro ao gerar cobranÃÂ§a");
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
      // fallback for older browsers
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
    ? "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrCode) + "&size=240x240&margin=8"
    : "";

  const btnStyle: React.CSSProperties = { minHeight: "44px", touchAction: "manipulation", cursor: "pointer" };
  const inputStyle: React.CSSProperties = { fontSize: "16px", padding: "10px", borderRadius: "8px", border: "1px solid #444", background: "#111", color: "#fff", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ padding: "16px", background: "#1a1a2e", borderRadius: "12px", color: "#fff", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 12px", color: "#00d4aa" }}>Ã°ÂÂÂ° Depositar via PIX</h3>

      {!qrCode ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[5, 10, 20, 50].map(v => (
              <button key={v} type="button" onClick={() => setValor(String(v))}
                style={{ ...btnStyle, padding: "8px 16px", background: valor === String(v) ? "#00d4aa" : "#333", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold" }}>
                R$ {v}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Outro valor (R$)" value={valor} min="1" step="0.01"
            onChange={e => setValor(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="CPF (000.000.000-00)" value={cpf} inputMode="numeric"
            onChange={e => setCpf(formatCpf(e.target.value))} style={inputStyle} />
          {erro && <p style={{ color: "#ff6b6b", margin: 0 }}>{erro}</p>}
          <button type="submit" disabled={loading}
            style={{ ...btnStyle, padding: "12px", background: loading ? "#555" : "#00d4aa", color: "#000", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px" }}>
            {loading ? "Gerando PIX..." : "Gerar QR Code PIX"}
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <p style={{ margin: 0, color: "#aaa" }}>Escaneie o QR code ou copie o cÃÂ³digo PIX:</p>
          <img src={qrImageUrl} alt="QR Code PIX"
            style={{ width: "240px", height: "240px", borderRadius: "8px", background: "#fff", padding: "4px" }}
            onError={() => setQrError(true)} />
            {qrError && (
              <div style={{ color: "#f90", fontSize: "13px", marginTop: "4px" }}>
                â ï¸ Imagem do QR nÃ£o carregou. Copie o cÃ³digo abaixo e cole no seu banco.
              </div>
            )}
          <div style={{ background: "#111", padding: "12px", borderRadius: "8px", width: "100%", wordBreak: "break-all", fontSize: "12px", color: "#ccc" }}>
            {qrCode}
          </div>
          <button
          onClick={handleCopy}
          disabled={!qrCode}
          style={{
            marginTop: "10px",
            width: "100%",
            padding: "12px",
            background: copied ? "#22c55e" : "#f97316",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "15px",
            cursor: qrCode ? "pointer" : "not-allowed",
            transition: "background 0.3s",
            letterSpacing: "0.5px",
          }}
        >
          {copied ? "✅ Código copiado!" : "📋 Copiar código PIX"}
        </button>
          <button onClick={() => { setQrCode("");
      setQrError(false); setErro(""); }}
            style={{ ...btnStyle, padding: "8px", background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "8px", width: "100%" }}>
            Ã¢ÂÂ Novo depÃÂ³sito
          </button>
        </div>
      )}
    </div>
  );
}