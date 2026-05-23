import { useState } from "react";

interface Props {
  jogadorId: number;
}

export default function PixDeposito({ jogadorId }: Props) {
  const [valor, setValor] = useState<number>(10);
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [erro, setErro] = useState("");

  const formatCpf = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const gerarCobranca = async () => {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setErro("CPF inválido. Digite os 11 dígitos.");
      return;
    }
    setLoading(true);
    setErro("");
    setQrCode("");
    setQrImage("");
    try {
      const resp = await fetch(
        (import.meta.env.VITE_API_URL || "https://campfreefire-production.up.railway.app") +
          "/pix/criar-cobranca",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": String(jogadorId) },
          body: JSON.stringify({ jogador_id: jogadorId, valor, cpf: cpfDigits }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Erro ao gerar cobrança");
      setQrCode(data.qr_code);
      setQrImage(data.qr_code_image);
      setInvoiceId(data.invoice_id);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px", background: "#1a1a2e", borderRadius: "12px", color: "#fff", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 12px", color: "#00d4aa" }}>💰 Depositar via PIX</h3>

      {/* Valor */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#aaa" }}>Valor (R$)</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          {[5, 10, 20, 50].map((v) => (
            <button
              key={v}
              onClick={() => setValor(v)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: valor === v ? "2px solid #00d4aa" : "1px solid #444",
                background: valor === v ? "#00d4aa22" : "#2a2a3e",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              R$ {v}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #444", background: "#2a2a3e", color: "#fff", boxSizing: "border-box" }}
        />
      </div>

      {/* CPF */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", color: "#aaa" }}>Seu CPF</label>
        <input
          type="text"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #444", background: "#2a2a3e", color: "#fff", boxSizing: "border-box" }}
        />
      </div>

      <button
        onClick={gerarCobranca}
        disabled={loading}
        style={{
          width: "100%",
          padding: "10px",
          background: loading ? "#555" : "#00d4aa",
          color: "#000",
          fontWeight: "bold",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "15px",
        }}
      >
        {loading ? "Gerando QR Code..." : "Gerar QR Code PIX"}
      </button>

      {erro && <p style={{ color: "#ff6b6b", marginTop: "10px", fontSize: "13px" }}>{erro}</p>}

      {qrCode && (
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          {qrImage && <img src={qrImage} alt="QR Code PIX" style={{ width: "200px", height: "200px", borderRadius: "8px" }} />}
          <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>Código PIX:</p>
          <div
            style={{ background: "#2a2a3e", padding: "8px", borderRadius: "8px", fontSize: "11px", wordBreak: "break-all", cursor: "pointer" }}
            onClick={() => navigator.clipboard.writeText(qrCode)}
            title="Clique para copiar"
          >
            {qrCode}
          </div>
          <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>Clique no código para copiar</p>
          <p style={{ fontSize: "11px", color: "#888" }}>ID: {invoiceId}</p>
        </div>
      )}
    </div>
  );
}
