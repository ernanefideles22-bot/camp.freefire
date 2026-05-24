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
  const [invoiceId, setInvoiceId] = useState("");
  const [erro, setErro] = useState("");
  const [copied, setCopied] = useState(false);

  const cpfDigits = cpf.replace(/\D/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setQrCode(""); setInvoiceId(""); setCopied(false);
    if (!valor || parseFloat(valor) < 1) { setErro("Valor mínimo: R$ 1,00"); return; }
    if (cpfDigits.length !== 11) { setErro("CPF inválido — informe 11 dígitos"); return; }
    setLoading(true);
    try {
      const r = await fetch(API + "/pix/criar-cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jogador_id: jogadorId, valor: parseFloat(valor), cpf: cpfDigits }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Erro ao gerar cobrança");
      setQrCode(data.qr_code || "");
      setInvoiceId(data.invoice_id || "");
    } catch (err: any) {
      setErro(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 3000); });
  }

  const qrImageUrl = qrCode
    ? "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(qrCode) + "&size=240x240&margin=8"
    : "";

  const btnStyle: React.CSSProperties = { minHeight: "44px", touchAction: "manipulation", cursor: "pointer" };
  const inputStyle: React.CSSProperties = { fontSize: "16px", padding: "10px", borderRadius: "8px", border: "1px solid #444", background: "#111", color: "#fff", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ padding: "16px", background: "#1a1a2e", borderRadius: "12px", color: "#fff", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 12px", color: "#00d4aa" }}>💰 Depositar via PIX</h3>

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
          <p style={{ margin: 0, color: "#aaa" }}>Escaneie o QR code ou copie o código PIX:</p>
          <img src={qrImageUrl} alt="QR Code PIX"
            style={{ width: "240px", height: "240px", borderRadius: "8px", background: "#fff", padding: "4px" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div style={{ background: "#111", padding: "12px", borderRadius: "8px", width: "100%", wordBreak: "break-all", fontSize: "12px", color: "#ccc" }}>
            {qrCode}
          </div>
          <button onClick={handleCopy}
            style={{ ...btnStyle, padding: "12px 24px", background: copied ? "#00d4aa" : "#333", color: copied ? "#000" : "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "15px", width: "100%" }}>
            {copied ? "✓ Copiado!" : "📋 Copiar código PIX"}
          </button>
          <button onClick={() => { setQrCode(""); setErro(""); }}
            style={{ ...btnStyle, padding: "8px", background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: "8px", width: "100%" }}>
            ← Novo depósito
          </button>
        </div>
      )}
    </div>
  );
}