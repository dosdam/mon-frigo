import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export default function Scanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState('Initialisation de la caméra…');
  const [manual, setManual] = useState('');

  useEffect(() => {
    let mounted = true;
    const scanner = new Html5Qrcode('reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE
      ],
      verbose: false
    });
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 140 }, aspectRatio: 1.7778 },
      decodedText => {
        if (!handledRef.current) {
          handledRef.current = true;
          navigator.vibrate?.(100);
          stop().finally(() => onScan(decodedText));
        }
      },
      () => {}
    ).then(() => mounted && setStatus('Placez le code-barres dans le cadre'))
     .catch(error => mounted && setStatus(cameraMessage(error)));

    return () => { mounted = false; stop(); };
  }, []);

  async function stop() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try { if (scanner.isScanning) await scanner.stop(); } catch {}
    try { await scanner.clear(); } catch {}
    scannerRef.current = null;
  }

  async function close() { await stop(); onClose(); }
  function submit(e) { e.preventDefault(); const code = manual.trim(); if (code) { handledRef.current = true; stop().finally(() => onScan(code)); } }

  return <div>
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold">Scanner un produit</h2><p className="text-xs text-slate-500">EAN, UPC, Code 128 ou QR Code</p></div>
      <button onClick={close} className="rounded-full bg-slate-200 px-3 py-1.5 font-bold">×</button>
    </div>
    <div id="reader" className="overflow-hidden rounded-2xl bg-slate-900"></div>
    <p className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">{status}</p>
    <div className="my-4 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/>saisie manuelle<span className="h-px flex-1 bg-slate-200"/></div>
    <form onSubmit={submit} className="flex gap-2">
      <input inputMode="numeric" value={manual} onChange={e => setManual(e.target.value)} placeholder="Code-barres" className="min-w-0 flex-1 rounded-xl border p-3 outline-none focus:ring-2 focus:ring-cyan-500"/>
      <button disabled={!manual.trim()} className="rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-40">Valider</button>
    </form>
  </div>;
}

function cameraMessage(error) {
  const text = String(error || '');
  if (/permission|NotAllowed/i.test(text)) return 'Permission caméra refusée. Autorisez la caméra dans les réglages Android.';
  if (/not found|NotFound/i.test(text)) return 'Aucune caméra compatible détectée.';
  return `Impossible de démarrer la caméra : ${text}`;
}
