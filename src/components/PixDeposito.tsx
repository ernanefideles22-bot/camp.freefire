// Componente PIX para o frontend — adicionar dentro de PlayerPortal.tsx ou como componente separado
// Integra com o backend /pix/criar-cobranca

import { useState } from "react";
import { apiService } from "../services/api";

interface CobrancaResponse {
  id: string;
  qr_code: string;
  qr_code_image: string;
  valor: number;
  status: string;
  expiracao: string;
}

interface Props {
  jogadorId: number;
}

export default function PixDeposito({ jogadorId }: Props) {
  const [valor, setValor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cobranca, setCobranca] = useState<CobrancaResponse | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string>("");

  const criarCobranca = async () => {
    const v = parseFloat(valor);
    if (!v || v < 1) { setErro("Valor mínimo: R$ 1,00"); return; }
    setErro("");
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/pix/criar-cobranca`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": String(jogadorId) },
          body: JSON.stringify({ jogador_id: jogadorId, valor: v }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setCobranca(await res.json());
    } catch (e: any) {
      setErro("Erro ao gerar PIX: " + (e.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const copiarCodigo = () => {
    if (!cobranca?.qr_code) return;
    navigator.clipboard.writeText(cobranca.qr_code);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const resetar = () => { setCobranca(null); setValor(""); setErro(""); };

  if (cobranca) {
    return (
      <div style={{ background: "#1a1a2e", border: "1px solid #ff6b35", borderRadius: 12, padding: 24, maxWidth: 400 }}>
        <h3 style={{ color: "#ff6b35", textAlign: "center", margin: "0 0 16px" }}>
          💰 PIX GERADO — R$ {cobranca.valor.toFixed(2)}
        </h3>

        {/* QR Code */}
        {cobranca.qr_code_image ? (
          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <img
              src={`data:image/png;base64,${cobranca.qr_code_image}`}
              alt="QR Code PIX"
              style={{ width: 200, height: 200, border: "4px solid #ff6b35", borderRadius: 8 }}
            />
          </div>
        ) : (
          <div style={{
            background: "#0d0d1a", border: "1px dashed #ff6b35", borderRadius: 8,
            padding: 16, margin: "16px 0", textAlign: "center", color: "#888"
          }}>
            QR Code indisponível — use o código abaixo
          </div>
        )}

        {/* Código Copia e Cola */}
        <p style={{ color: "#aaa", fontSize: 12, margin: "12px 0 4px" }}>Código PIX (Copia e Cola):</p>
        <div style={{
          background: "#0d0d1a", border: "1px solid #333", borderRadius: 6,
          padding: "8px 12px", fontSize: 11, color: "#ccc",
          wordBreak: "break-all", maxHeight: 80, overflow: "auto"
        }}>
          {cobranca.qr_code || "Código não disponível"}
        </div>

        <button
          onClick={copiarCodigo}
          style={{
            width: "100%", margin: "12px 0 0", padding: "10px 0",
            background: copiado ? "#22c55e" : "#ff6b35",
            color: "#fff", border: "none", borderRadius: 8,
            cursor: "pointer", fontWeight: "bold", fontSize: 14
          }}
        >
          {copiado ? "✅ COPIADO!" : "📋 COPIAR CÓDIGO PIX"}
        </button>

        <p style={{ color: "#888", fontSize: 11, textAlign: "center", margin: "8px 0" }}>
          Expira em 30 minutos • Após pagar, o saldo será creditado automaticamente
        </p>

        <button
          onClick={resetar}
          style={{
            width: "100%", padding: "8px 0", background: "transparent",
            color: "#888", border: "1px solid #333", borderRadius: 8,
            cursor: "pointer", fontSize: 13
          }}
        >
          Gerar novo PIX
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 12, padding: 24, maxWidth: 400 }}>
      <h3 style={{ color: "#ff6b35", margin: "0 0 16px" }}>💸 Depositar via PIX</h3>

      <label style={{ color: "#aaa", fontSize: 13 }}>Valor do depósito:</label>
      <div style={{ display: "flex", gap: 8, margin: "8px 0 4px" }}>
        {[5, 10, 20, 50].map((v) => (
          <button
            key={v}
            onClick={() => setValor(String(v))}
            style={{
              flex: 1, padding: "8px 0",
              background: valor === String(v) ? "#ff6b35" : "#0d0d1a",
              color: valor === String(v) ? "#fff" : "#aaa",
              border: "1px solid #333", borderRadius: 6, cursor: "pointer", fontSize: 13
            }}
          >
            R${v}
          </button>
        ))}
      </div>

      <input
        type="number"
        min="1"
        step="0.01"
        placeholder="Ou digite o valor \(R$\)"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        style={{
          width: "100%", padding: "10px 12px", background: "#0d0d1a",
          border: "1px solid #333", borderRadius: 8, color: "#fff",
          fontSize: 14, boxSizing: "border-box", margin: "8px 0"
        }}
      />

      {erro && <p style={{ color: "#ef4444", fontSize: 13, margin: "4px 0" }}>⚠️ {erro}</p>}

      <button
        onClick={criarCobranca}
        disabled={loading}
        style={{
          width: "100%", padding: "12px 0", marginTop: 8,
          background: loading ? "#555" : "#ff6b35",
          color: "#fff", border: "none", borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: "bold", fontSize: 15
        }}
      >
        {loading ? "Gerando PIX..." : "⚡ GERAR QR CODE PIX"}
      </button>

      <p style={{ color: "#555", fontSize: 11, textAlign: "center", margin: "12px 0 0" }}>
        Processado via Cora Bank • Aprovação instantânea
      </p>
    </div>
  );
}
