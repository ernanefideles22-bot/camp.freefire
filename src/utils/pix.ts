// Utilitario PIX: gera "Copia e Cola" (BR Code EMV) e QR code para pagamento manual.
// Usado no painel admin para acelerar o pagamento dos saques.

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function semAcento(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarChavePix(chave: string, tipo: string): string {
  const t = (tipo || '').toLowerCase();
  const raw = (chave || '').trim();
  if (t === 'cpf' || t === 'cnpj') return raw.replace(/\D/g, '');
  if (t === 'telefone' || t === 'phone' || t === 'celular') {
    const d = raw.replace(/\D/g, '').replace(/^55/, '');
    return '+55' + d;
  }
  if (t === 'email') return raw.toLowerCase();
  return raw; // aleatoria / EVP
}

export function gerarPixCopiaECola(o: { chave: string; tipo: string; valor: number; nome?: string; cidade?: string }): string {
  const chave = normalizarChavePix(o.chave, o.tipo);
  const nome = (semAcento(o.nome || 'RECEBEDOR').toUpperCase().slice(0, 25)) || 'RECEBEDOR';
  const cidade = (semAcento(o.cidade || 'BRASIL').toUpperCase().slice(0, 15)) || 'BRASIL';
  const gui = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave);
  const semCrc =
    tlv('00', '01') +
    tlv('26', gui) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', o.valor.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', nome) +
    tlv('60', cidade) +
    tlv('62', tlv('05', '***')) +
    '6304';
  return semCrc + crc16(semCrc);
}

let qrLibPromise: Promise<any> | null = null;
function ensureQrLib(): Promise<any> {
  const w = window as any;
  if (w.QRCode) return Promise.resolve(w.QRCode);
  if (!qrLibPromise) {
    qrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.async = true;
      s.onload = () => resolve((window as any).QRCode);
      s.onerror = () => reject(new Error('Falha ao carregar a biblioteca de QR.'));
      document.head.appendChild(s);
    });
  }
  return qrLibPromise;
}

export async function gerarQrDataUrl(payload: string): Promise<string> {
  const QRCode = await ensureQrLib();
  const div = document.createElement('div');
  new QRCode(div, { text: payload, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
  await new Promise((r) => setTimeout(r, 80));
  const img = div.querySelector('img') as HTMLImageElement | null;
  if (img && img.src) return img.src;
  const canvas = div.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) return canvas.toDataURL('image/png');
  throw new Error('Nao foi possivel gerar o QR.');
}
