'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle, Blocks, Check, CheckCircle2, ChevronRight, CircleDashed,
  ClipboardCheck, ExternalLink, FileCheck2, FileSearch, Fingerprint,
  LayoutDashboard, LoaderCircle, MapPinned, Plus, RotateCcw, Search,
  ShieldCheck, Sparkles, Upload, Wallet, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = 'Anchored' | 'Validated' | 'Needs review';
type FormData = { owner: string; survey: string; village: string; area: string; recordNo: string; issueDate: string };
type LandRecord = FormData & { id: string; status: Status; updated: string; hash?: string; txHash?: string; proof?: 'polygon' | 'local' };
type Step = 'upload' | 'processing' | 'review' | 'approved' | 'proof';

const seedRecords: LandRecord[] = [
  { id: 'LR-2026-0184', owner: 'Ananya Rao', survey: '48/2B', village: 'Devanahalli', area: '1.84', recordNo: 'RTC-1948-22', issueDate: '2022-06-14', status: 'Anchored', updated: '08 Sep, 18:42', hash: '4ee296866a75a25f92cf4a87b34b61d13b89f79d2f7bc59cf690aa7cfe4f314d', txHash: '0xc143b140fa1f68b5c603bbff2819e7db62e6df3bfeee131eb19010223f58a12e', proof: 'local' },
  { id: 'LR-2026-0183', owner: 'Vikram Gowda', survey: '112/7', village: 'Hoskote', area: '2.10', recordNo: 'RTC-7731-19', issueDate: '2019-11-02', status: 'Validated', updated: '08 Sep, 18:31' },
  { id: 'LR-2026-0182', owner: 'Meera Krishnan', survey: '48/2B', village: 'Devanahalli', area: '1.72', recordNo: 'RTC-2040-23', issueDate: '2023-01-18', status: 'Needs review', updated: '08 Sep, 18:19' },
  { id: 'LR-2026-0181', owner: 'Rohan Kulkarni', survey: '73/4A', village: 'Doddaballapur', area: '0.96', recordNo: 'RTC-6634-21', issueDate: '2021-04-27', status: 'Anchored', updated: '08 Sep, 17:54', hash: '91ce19034a3ce586d75b4d14a92638c0f9756762a2fd5d2f2f275a517750e460', txHash: 'LOCAL-51A4D9F73', proof: 'local' },
];

const blankForm: FormData = { owner: '', survey: '', village: '', area: '', recordNo: '', issueDate: '' };
const demoForm: FormData = { owner: 'Meera Krishnan', survey: '48/2B', village: 'Devanahalli', area: '1.84', recordNo: 'RTC-2040-23', issueDate: '2023-01-18' };

declare global {
  interface Window { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }
  interface Document { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}

export default function Home() {
  const [records, setRecords] = useState(seedRecords);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [form, setForm] = useState<FormData>(blankForm);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentId, setCurrentId] = useState('');
  const [hash, setHash] = useState('');
  const [anchoredHash, setAnchoredHash] = useState('');
  const [txHash, setTxHash] = useState('');
  const [proof, setProof] = useState<'polygon' | 'local'>('local');
  const [verifyState, setVerifyState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => records.filter((record) =>
    [record.id, record.owner, record.survey, record.village, record.recordNo].some((value) => value.toLowerCase().includes(query.toLowerCase()))
  ), [query, records]);

  const conflicts = useMemo(() => records.filter((record) => record.survey.toLowerCase() === form.survey.toLowerCase() && record.village.toLowerCase() === form.village.toLowerCase() && record.id !== currentId), [form.survey, form.village, currentId, records]);
  const requiredComplete = Object.values(form).every(Boolean) && Number(form.area) > 0;

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'start_land_record_digitization',
      title: 'Start land record digitization',
      description: 'Open the visible digitization workflow with the built-in sample record prepared for human review.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => { setForm(demoForm); setFileName('sample-rtc-record.jpg'); setStep('review'); setDialogOpen(true); return { status: 'ready_for_review', survey_number: demoForm.survey }; },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function resetFlow() {
    setStep('upload'); setForm(blankForm); setFileName(''); setFileUrl(''); setOcrText(''); setProgress(0); setCurrentId(''); setHash(''); setAnchoredHash(''); setTxHash(''); setVerifyState('idle'); setNotice('');
  }

  function openNew() { resetFlow(); setDialogOpen(true); }

  function loadSample() {
    setFileName('sample-rtc-record.jpg');
    setForm(demoForm);
    setOcrText('RECORD OF RIGHTS · Owner: Meera Krishnan · Survey No: 48/2B · Village: Devanahalli · Extent: 1.84 acres · RTC-2040-23 · Issued 18/01/2023');
    setProgress(100); setStep('review');
  }

  async function runOcr(file: File) {
    setFileName(file.name); setFileUrl(URL.createObjectURL(file)); setStep('processing'); setProgress(8); setNotice('Reading document locally in your browser…');
    try {
      const { recognize } = await import('tesseract.js');
      const result = await recognize(file, 'eng', { logger: (message) => { if (message.status === 'recognizing text') setProgress(Math.max(12, Math.round(message.progress * 100))); } });
      const text = result.data.text || '';
      setOcrText(text);
      setForm(parseOcr(text));
      setProgress(100); setNotice(text.trim() ? 'OCR complete. Confirm the extracted fields.' : 'No clear text found. Enter the fields manually.');
    } catch {
      setNotice('OCR could not finish. The review form is ready for manual entry.');
    }
    setStep('review');
  }

  async function approveRecord() {
    if (!requiredComplete || conflicts.length) return;
    const newHash = await hashRecord(form);
    const id = currentId || `LR-2026-${String(185 + records.filter((r) => Number(r.id.slice(-4)) >= 185).length).padStart(4, '0')}`;
    const record: LandRecord = { ...form, id, status: 'Validated', updated: 'Just now' };
    setCurrentId(id); setHash(newHash); setRecords((old) => [record, ...old.filter((item) => item.id !== id)]); setStep('approved'); setNotice('All six checks passed. The approved snapshot is ready to anchor.');
  }

  async function anchorOnPolygon() {
    setAnchorBusy(true); setNotice('Waiting for wallet confirmation…');
    try {
      if (!window.ethereum) throw new Error('NO_WALLET');
      try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x13882' }] }); }
      catch { await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x13882', chainName: 'Polygon Amoy', nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpcUrls: ['https://polygon-amoy.drpc.org'], blockExplorerUrls: ['https://amoy.polygonscan.com'] }] }); }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const transaction = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: accounts[0], to: accounts[0], value: '0x0', data: `0x${hash}` }] }) as string;
      setTxHash(transaction); setAnchoredHash(hash); setProof('polygon'); setStep('proof'); setRecords((old) => old.map((record) => record.id === currentId ? { ...record, status: 'Anchored', hash, txHash: transaction, proof: 'polygon' } : record)); setNotice('Fingerprint submitted to Polygon Amoy.');
    } catch (error) {
      setNotice(error instanceof Error && error.message === 'NO_WALLET' ? 'No browser wallet found. Use the offline proof for a reliable demo, or install MetaMask for live Amoy anchoring.' : 'Wallet transaction was cancelled or failed. No record data was sent.');
    } finally { setAnchorBusy(false); }
  }

  function createOfflineProof() {
    const receipt = `LOCAL-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    setTxHash(receipt); setAnchoredHash(hash); setProof('local'); setStep('proof'); setRecords((old) => old.map((record) => record.id === currentId ? { ...record, status: 'Anchored', hash, txHash: receipt, proof: 'local' } : record)); setNotice('Offline proof created. This is a demo fallback—not a blockchain transaction.');
  }

  async function verifyIntegrity() {
    const currentHash = await hashRecord(form);
    setHash(currentHash); setVerifyState(currentHash === anchoredHash ? 'valid' : 'invalid');
  }

  async function openRecord(record: LandRecord) {
    setForm({ owner: record.owner, survey: record.survey, village: record.village, area: record.area, recordNo: record.recordNo, issueDate: record.issueDate });
    setCurrentId(record.id); setFileName(`${record.recordNo.toLowerCase()}.jpg`); setHash(record.hash || await hashRecord(record)); setAnchoredHash(record.hash || ''); setTxHash(record.txHash || ''); setProof(record.proof || 'local'); setVerifyState('idle'); setNotice(''); setStep(record.status === 'Anchored' ? 'proof' : record.status === 'Validated' ? 'approved' : 'review'); setDialogOpen(true);
  }

  return (
    <main className="min-h-screen bg-[#f3f6f8] text-slate-950">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/10 bg-[#071b2b] px-4 text-white shadow-sm md:px-7">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 text-[#071b2b] shadow-[0_0_22px_rgba(45,212,191,.24)]"><MapPinned className="h-5 w-5" /></div><div><p className="text-base font-bold tracking-tight">BhoomiSetu</p><p className="text-xs text-slate-400">Land Records Intelligence</p></div></div>
        <div className="ml-auto flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 sm:flex"><span className="h-2 w-2 rounded-full bg-teal-400" />Verification ready</div><div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold">AR</div></div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <nav className="space-y-1"><NavItem icon={LayoutDashboard} label="Record registry" active /><NavItem icon={Upload} label="Digitize record" onClick={openNew} /><NavItem icon={FileCheck2} label="Review queue" count="1" onClick={() => void openRecord(records.find((r) => r.status === 'Needs review')!)} /><NavItem icon={Fingerprint} label="Verify integrity" onClick={() => void openRecord(records.find((r) => r.status === 'Anchored')!)} /></nav>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm"><Blocks className="h-4 w-4" /></div><p className="text-sm font-semibold">Tamper-evident ledger</p><p className="mt-1 text-xs leading-5 text-slate-500">Only a SHA-256 fingerprint is anchored. Personal record data stays off-chain.</p></div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8"><div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-semibold text-teal-700">Karnataka · Bengaluru Rural</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Land record registry</h1><p className="mt-1 text-sm text-slate-500">Digitize, validate, and verify every approved record.</p></div><Button onClick={openNew} className="h-11 rounded-xl bg-[#0b766d] px-5 text-white shadow-sm hover:bg-[#09665f]"><Plus className="mr-2 h-4 w-4" /> Digitize new record</Button></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={FileSearch} label="Total records" value={String(180 + records.length).padStart(3, '0')} detail="12 added this week" /><Metric icon={ShieldCheck} label="Validated" value={String(172 + records.filter((r) => r.status !== 'Needs review').length).padStart(3, '0')} detail="Registry quality checks passed" tone="teal" /><Metric icon={FileCheck2} label="Needs review" value={String(records.filter((r) => r.status === 'Needs review').length).padStart(2, '0')} detail="1 high-priority conflict" tone="amber" /></div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Recent records</h2><p className="text-xs text-slate-500">Search by owner, survey number, village, or record ID</p></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the registry…" className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9" /></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Record</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Parcel</th><th className="px-5 py-3">Area</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Updated</th><th className="px-5 py-3"><span className="sr-only">Open</span></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((record) => <tr key={record.id} onClick={() => void openRecord(record)} className="group cursor-pointer transition-colors hover:bg-slate-50"><td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">{record.id}</td><td className="px-5 py-4 font-semibold">{record.owner}</td><td className="px-5 py-4"><span className="font-medium">{record.survey}</span><span className="block text-xs text-slate-500">{record.village}</span></td><td className="px-5 py-4 text-slate-600">{record.area} ac</td><td className="px-5 py-4"><StatusBadge status={record.status} /></td><td className="px-5 py-4 text-xs text-slate-500">{record.updated}</td><td className="px-5 py-4"><ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" /></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500">No records match “{query}”.</div>}</div>
          </div>
        </div></section>
      </div>

      {dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) setDialogOpen(false); }}>
        <dialog open aria-labelledby="record-dialog-title" className="relative m-0 max-h-[92vh] w-[min(1100px,calc(100%-1.5rem))] max-w-none overflow-y-auto rounded-2xl bg-white p-0 text-slate-950 shadow-2xl ring-1 ring-slate-950/10">
          <button onClick={() => setDialogOpen(false)} className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close dialog"><XCircle className="h-5 w-5" /></button>
          <header className="border-b border-slate-200 px-5 py-4 pr-14"><h2 id="record-dialog-title" className="flex items-center gap-2 text-lg font-semibold"><Fingerprint className="h-5 w-5 text-teal-700" />{step === 'upload' ? 'Digitize a land record' : currentId || 'New land record'}</h2><p className="mt-1 text-sm text-slate-500">{stepLabel(step)}</p></header>
          <div className="px-5 py-5 md:px-6">
            <StepRail step={step} />
            {step === 'upload' && <UploadStage onFile={(file) => void runOcr(file)} onSample={loadSample} fileInput={fileInput} />}
            {step === 'processing' && <ProcessingStage progress={progress} fileName={fileName} />}
            {step === 'review' && <ReviewStage form={form} setForm={setForm} fileName={fileName} fileUrl={fileUrl} ocrText={ocrText} conflicts={conflicts} requiredComplete={requiredComplete} onApprove={() => void approveRecord()} onReset={resetFlow} />}
            {step === 'approved' && <ApprovedStage hash={hash} form={form} notice={notice} busy={anchorBusy} onAnchor={() => void anchorOnPolygon()} onOffline={createOfflineProof} />}
            {step === 'proof' && <ProofStage form={form} setForm={setForm} hash={hash} txHash={txHash} proof={proof} verifyState={verifyState} notice={notice} onVerify={() => void verifyIntegrity()} onDone={() => setDialogOpen(false)} />}
          </div>
        </dialog>
      </div>}
    </main>
  );
}

function UploadStage({ onFile, onSample, fileInput }: { onFile: (file: File) => void; onSample: () => void; fileInput: React.RefObject<HTMLInputElement | null> }) {
  return <div className="mx-auto max-w-2xl py-7"><button onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) onFile(file); }} className="group flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-teal-500 hover:bg-teal-50/40"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-1"><Upload className="h-6 w-6" /></div><p className="mt-5 font-semibold">Drop a scanned record here</p><p className="mt-1 text-sm text-slate-500">PNG or JPEG · typed English · one page</p><span className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Choose document</span><input ref={fileInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} /></button><div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use the guaranteed demo path<span className="h-px flex-1 bg-slate-200" /></div><Button onClick={onSample} variant="outline" className="h-11 w-full rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50"><Sparkles className="mr-2 h-4 w-4" />Load sample RTC record</Button></div>;
}

function ProcessingStage({ progress, fileName }: { progress: number; fileName: string }) {
  return <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center"><div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-teal-50 text-teal-700"><FileSearch className="h-8 w-8" /><LoaderCircle className="absolute -right-2 -top-2 h-6 w-6 animate-spin text-teal-600" /></div><h3 className="mt-6 text-xl font-bold">Reading the document</h3><p className="mt-1 max-w-sm text-sm text-slate-500">OCR runs locally in this browser. The scan is not uploaded to a third-party OCR service.</p><div className="mt-7 w-full"><div className="mb-2 flex justify-between text-xs"><span className="truncate text-slate-500">{fileName}</span><span className="font-semibold text-teal-700">{progress}%</span></div><progress value={progress} max={100} className="h-2 w-full overflow-hidden rounded-full accent-teal-600" /></div></div>;
}

function ReviewStage({ form, setForm, fileName, fileUrl, ocrText, conflicts, requiredComplete, onApprove, onReset }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>; fileName: string; fileUrl: string; ocrText: string; conflicts: LandRecord[]; requiredComplete: boolean; onApprove: () => void; onReset: () => void }) {
  return <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-semibold">Source document</p><p className="max-w-52 truncate text-xs text-slate-500">{fileName}</p></div><Badge variant="outline">Original</Badge></div><div className="flex min-h-[440px] items-center justify-center p-5">{fileUrl ? <Image unoptimized src={fileUrl} alt="Uploaded land record" width={700} height={900} className="max-h-[430px] w-auto max-w-full rounded-lg object-contain shadow-lg" /> : <SampleDocument />}</div>{ocrText && <details className="border-t border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">View raw OCR text</summary><p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-500">{ocrText}</p></details>}</div><div><div className="flex items-start justify-between"><div><h3 className="font-bold">Confirm extracted fields</h3><p className="mt-1 text-sm text-slate-500">Human approval is required before a record can be trusted.</p></div><Badge className="bg-amber-100 text-amber-800">Review required</Badge></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Owner name" name="owner" value={form.owner} setForm={setForm} /><Field label="Survey number" name="survey" value={form.survey} setForm={setForm} /><Field label="Village" name="village" value={form.village} setForm={setForm} /><Field label="Area (acres)" name="area" value={form.area} setForm={setForm} type="number" /><Field label="Record number" name="recordNo" value={form.recordNo} setForm={setForm} /><Field label="Issue date" name="issueDate" value={form.issueDate} setForm={setForm} type="date" /></div><div className={`mt-5 rounded-xl border p-4 ${conflicts.length ? 'border-amber-200 bg-amber-50' : requiredComplete ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>{conflicts.length ? <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-900">Possible parcel conflict</p><p className="mt-1 text-xs leading-5 text-amber-800">Survey {form.survey} in {form.village} already appears under {conflicts[0].owner} with {conflicts[0].area} acres. Correct the survey number or investigate before approval.</p></div></div> : requiredComplete ? <div className="flex gap-3"><ClipboardCheck className="h-5 w-5 text-teal-700" /><div><p className="text-sm font-semibold text-teal-900">6 checks passed</p><p className="mt-1 text-xs text-teal-800">Required fields, area, date, identifier format, and duplicate parcel checks completed.</p></div></div> : <div className="flex gap-3"><CircleDashed className="h-5 w-5 text-slate-500" /><p className="text-sm text-slate-600">Complete all fields to run validation.</p></div>}</div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button variant="ghost" onClick={onReset}><RotateCcw className="mr-2 h-4 w-4" />Start over</Button><Button disabled={!requiredComplete || !!conflicts.length} onClick={onApprove} className="bg-[#0b766d] text-white hover:bg-[#09665f]"><Check className="mr-2 h-4 w-4" />Approve validated record</Button></div></div></div>;
}

function ApprovedStage({ hash, form, notice, busy, onAnchor, onOffline }: { hash: string; form: FormData; notice: string; busy: boolean; onAnchor: () => void; onOffline: () => void }) {
  return <div className="mx-auto max-w-3xl py-8"><div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-teal-700"><ShieldCheck className="h-8 w-8" /></div><h3 className="mt-5 text-2xl font-bold">Record validated</h3><p className="mt-2 text-sm text-slate-500">The approved snapshot is locked into a deterministic SHA-256 fingerprint.</p></div><div className="mt-7 rounded-2xl border border-slate-200 bg-[#071b2b] p-5 text-white"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Record fingerprint</p><Fingerprint className="h-5 w-5 text-teal-300" /></div><p className="mt-3 break-all font-mono text-sm leading-6 text-slate-200">{hash}</p><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs"><div><span className="text-slate-400">Owner</span><p className="mt-1 font-semibold">{form.owner}</p></div><div><span className="text-slate-400">Parcel</span><p className="mt-1 font-semibold">{form.survey}</p></div><div><span className="text-slate-400">Area</span><p className="mt-1 font-semibold">{form.area} ac</p></div></div></div>{notice && <p className="mt-4 text-center text-sm text-amber-700">{notice}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><Button onClick={onAnchor} disabled={busy} className="h-auto min-h-16 justify-start rounded-xl bg-[#0b766d] px-4 py-3 text-left text-white hover:bg-[#09665f]">{busy ? <LoaderCircle className="mr-3 h-5 w-5 animate-spin" /> : <Wallet className="mr-3 h-5 w-5" />}<span><span className="block font-semibold">Anchor on Polygon Amoy</span><span className="block text-xs font-normal text-teal-100">Requires MetaMask and test POL</span></span></Button><Button onClick={onOffline} variant="outline" className="h-auto min-h-16 justify-start rounded-xl px-4 py-3 text-left"><Blocks className="mr-3 h-5 w-5 text-slate-600" /><span><span className="block font-semibold">Create offline demo proof</span><span className="block text-xs font-normal text-slate-500">Reliable fallback · clearly labeled</span></span></Button></div><p className="mt-5 text-center text-xs text-slate-500">Only the fingerprint is sent to the blockchain. Names, parcel details, and documents remain off-chain.</p></div>;
}

function ProofStage({ form, setForm, hash, txHash, proof, verifyState, notice, onVerify, onDone }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>; hash: string; txHash: string; proof: 'polygon' | 'local'; verifyState: 'idle' | 'valid' | 'invalid'; notice: string; onVerify: () => void; onDone: () => void }) {
  return <div className="mx-auto max-w-3xl py-6"><div className={`rounded-2xl border p-6 ${verifyState === 'invalid' ? 'border-red-200 bg-red-50' : 'border-teal-200 bg-teal-50'}`}><div className="flex items-start gap-4"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${verifyState === 'invalid' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>{verifyState === 'invalid' ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}</div><div><Badge className={proof === 'polygon' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-700'}>{proof === 'polygon' ? 'Polygon Amoy testnet' : 'Offline demo proof'}</Badge><h3 className={`mt-2 text-xl font-bold ${verifyState === 'invalid' ? 'text-red-950' : 'text-teal-950'}`}>{verifyState === 'invalid' ? 'Record changed after anchoring' : verifyState === 'valid' ? 'Integrity verified' : 'Fingerprint anchored'}</h3><p className={`mt-1 text-sm ${verifyState === 'invalid' ? 'text-red-800' : 'text-teal-800'}`}>{verifyState === 'invalid' ? 'The current record no longer matches the approved snapshot. Investigate before use.' : 'Recompute the fingerprint at any time to detect later changes.'}</p></div></div></div><div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proof reference</p><p className="mt-2 break-all font-mono text-xs text-slate-700">{txHash}</p><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Current fingerprint</p><p className="mt-2 break-all font-mono text-xs text-slate-700">{hash}</p></div>{proof === 'polygon' && <a href={`https://amoy.polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50">Explorer <ExternalLink className="ml-2 h-4 w-4" /></a>}</div><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><div><h4 className="font-semibold">Tamper test</h4><p className="mt-1 text-xs text-slate-500">Change one character, then verify against the anchored fingerprint.</p></div><Fingerprint className="h-5 w-5 text-slate-400" /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><div><Label htmlFor="proof-owner" className="mb-2 block text-xs">Owner name</Label><Input id="proof-owner" value={form.owner} onChange={(e) => { setForm((old) => ({ ...old, owner: e.target.value })); }} className="bg-white" /></div><Button onClick={onVerify} className="self-end bg-slate-900 text-white hover:bg-slate-800"><ShieldCheck className="mr-2 h-4 w-4" />Verify integrity</Button></div></div>{notice && <p className="mt-4 text-center text-xs text-slate-500">{notice}</p>}<div className="mt-6 flex justify-end"><Button onClick={onDone} variant="outline">Done</Button></div></div>;
}

function Field({ label, name, value, setForm, type = 'text' }: { label: string; name: keyof FormData; value: string; setForm: React.Dispatch<React.SetStateAction<FormData>>; type?: string }) { return <div><Label htmlFor={name} className="mb-2 block text-xs font-semibold text-slate-600">{label}</Label><Input id={name} type={type} value={value} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '.01' : undefined} onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))} className="h-10 bg-white" /></div>; }
function SampleDocument() { return <div className="w-full max-w-[370px] rotate-[-.6deg] rounded-sm bg-[#fffef8] p-7 font-serif text-slate-800 shadow-[0_12px_35px_rgba(15,23,42,.18)] ring-1 ring-slate-300"><div className="border-b-2 border-slate-800 pb-3 text-center"><p className="text-xs font-bold uppercase tracking-[.2em]">Government of Karnataka</p><p className="mt-2 text-lg font-bold">Record of Rights, Tenancy & Crops</p></div><div className="mt-5 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-xs"><b>Record No.</b><span>RTC-2040-23</span><b>Village</b><span>Devanahalli</span><b>Survey No.</b><span>48/2B</span><b>Owner</b><span>Meera Krishnan</span><b>Total extent</b><span>1.84 acres</span><b>Issue date</b><span>18 January 2023</span></div><div className="mt-8 flex justify-between border-t border-slate-300 pt-4 text-[10px] text-slate-500"><span>Digitally scanned copy</span><span>Revenue Department</span></div></div>; }
function StepRail({ step }: { step: Step }) { const active = step === 'upload' || step === 'processing' ? 0 : step === 'review' ? 1 : step === 'approved' ? 2 : 3; return <div className="mx-auto mb-2 flex max-w-2xl items-center">{['Upload', 'Review', 'Validate', 'Verify'].map((label, index) => <div key={label} className="contents"><div className="flex flex-col items-center gap-1"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index <= active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{index < active ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`text-[11px] font-semibold ${index <= active ? 'text-teal-800' : 'text-slate-400'}`}>{label}</span></div>{index < 3 && <span className={`mb-5 h-px flex-1 ${index < active ? 'bg-teal-600' : 'bg-slate-200'}`} />}</div>)}</div>; }
function StatusBadge({ status }: { status: Status }) { const classes = { Anchored: 'bg-teal-500/10 text-teal-700 border-teal-600/20', Validated: 'bg-sky-500/10 text-sky-700 border-sky-600/20', 'Needs review': 'bg-amber-500/10 text-amber-800 border-amber-600/20' }; return <Badge variant="outline" className={`rounded-full px-2.5 py-1 font-medium ${classes[status]}`}>{status === 'Anchored' && <CheckCircle2 className="mr-1 h-3 w-3" />}{status}</Badge>; }
function NavItem({ icon: Icon, label, active, count, onClick }: { icon: typeof LayoutDashboard; label: string; active?: boolean; count?: string; onClick?: () => void }) { return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" /><span>{label}</span>{count && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{count}</span>}</button>; }
function Metric({ icon: Icon, label, value, detail, tone = 'navy' }: { icon: typeof FileSearch; label: string; value: string; detail: string; tone?: 'navy' | 'teal' | 'amber' }) { const colors = { navy: 'bg-slate-100 text-slate-700', teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700' }; return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.03)]"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-slate-500">{detail}</p></div>; }
function stepLabel(step: Step) { return step === 'upload' ? 'Upload a clean, typed record or use the built-in sample.' : step === 'processing' ? 'Extracting text with browser-based OCR.' : step === 'review' ? 'Compare the source and confirm every field.' : step === 'approved' ? 'Validation passed. Anchor the approved fingerprint.' : 'Recompute the fingerprint to confirm integrity.'; }

function parseOcr(text: string): FormData {
  const line = text.replace(/\s+/g, ' ').trim();
  const capture = (patterns: RegExp[]) => { for (const pattern of patterns) { const match = line.match(pattern); if (match?.[1]) return match[1].trim(); } return ''; };
  const rawDate = capture([/(?:issue|issued|date)\s*[:.-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i]);
  const parts = rawDate.split(/[./-]/);
  const issueDate = parts.length === 3 ? `${parts[2].length === 2 ? `20${parts[2]}` : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : '';
  return { owner: capture([/(?:owner|holder|name)\s*[:.-]?\s*([A-Za-z][A-Za-z .]{3,40}?)(?=\s+(?:survey|village|extent|area|record|rtc|date|issued)|$)/i]), survey: capture([/(?:survey|sy\.?\s*no)\s*(?:no\.?)?\s*[:.-]?\s*([\d]+\/[\dA-Za-z]+)/i]), village: capture([/village\s*[:.-]?\s*([A-Za-z ]{3,30}?)(?=\s+(?:survey|owner|extent|area|record|rtc|date|issued)|$)/i]), area: capture([/(?:extent|area)\s*[:.-]?\s*([\d.]+)/i]), recordNo: capture([/\b((?:RTC|MR|LR)[-\s]\d{3,6}[-/]\d{2,4})\b/i]), issueDate };
}

async function hashRecord(form: Partial<FormData>) {
  const canonical = JSON.stringify({ version: 1, owner: form.owner?.trim().toLowerCase(), survey: form.survey?.trim().toUpperCase(), village: form.village?.trim().toLowerCase(), area: Number(form.area).toFixed(2), recordNo: form.recordNo?.trim().toUpperCase(), issueDate: form.issueDate });
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
