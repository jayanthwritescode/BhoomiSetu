'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { canManage, type Profile } from '@/lib/access';
import { OwnershipPanel, AccessGuide } from '@/components/ownership-panel';
import {
  amoyRpc,
  waitForReceipt,
  readAmoyTransaction,
  type AmoyReceipt,
} from '@/lib/polygon';
import {
  hashRecord,
  parseOcr,
  normalizeParcel,
  validationErrors,
  type FormData,
} from '@/lib/records';
import { recognizeScan } from '@/lib/ocr';
import {
  AlertTriangle,
  Blocks,
  Download,
  CircleHelp,
  UserRound,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Fingerprint,
  LayoutDashboard,
  LoaderCircle,
  MapPinned,
  Plus,
  RotateCcw,
  Search,
  Languages,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status =
  | 'Attested'
  | 'Anchored'
  | 'Pending'
  | 'Validated'
  | 'Needs review';
type ProofType = 'wallet' | 'polygon' | 'local';
type LandRecord = FormData & {
  id: string;
  status: Status;
  updated: string;
  hash?: string;
  txHash?: string;
  proof?: ProofType;
  signer?: string;
  chainStatus?: ChainStatus;
};
type Step =
  | 'details'
  | 'upload'
  | 'processing'
  | 'review'
  | 'approved'
  | 'proof';
type OcrLanguage = 'eng' | 'eng+kan';
type FieldConfidence = Record<keyof FormData, number>;
type ChainStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

const AMOY_CHAIN_ID = '0x13882';
const AMOY_RPC = 'https://polygon-amoy.drpc.org';
const AMOY_EXPLORER = 'https://amoy.polygonscan.com';

const seedRecords: LandRecord[] = [
  {
    id: 'LR-2026-0184',
    owner: 'Ananya Rao',
    survey: '48/2B',
    village: 'Devanahalli',
    area: '1.84',
    recordNo: 'RTC-1948-22',
    issueDate: '2022-06-14',
    status: 'Validated',
    updated: '08 Sep, 18:42',
  },
  {
    id: 'LR-2026-0183',
    owner: 'Vikram Gowda',
    survey: '112/7',
    village: 'Hoskote',
    area: '2.10',
    recordNo: 'RTC-7731-19',
    issueDate: '2019-11-02',
    status: 'Validated',
    updated: '08 Sep, 18:31',
  },
  {
    id: 'LR-2026-0182',
    owner: 'Meera Krishnan',
    survey: '48/2B',
    village: 'Devanahalli',
    area: '1.72',
    recordNo: 'RTC-2040-23',
    issueDate: '2023-01-18',
    status: 'Needs review',
    updated: '08 Sep, 18:19',
  },
  {
    id: 'LR-2026-0181',
    owner: 'Rohan Kulkarni',
    survey: '73/4A',
    village: 'Doddaballapur',
    area: '0.96',
    recordNo: 'RTC-6634-21',
    issueDate: '2021-04-27',
    status: 'Validated',
    updated: '08 Sep, 17:54',
  },
];

const blankForm: FormData = {
  owner: '',
  survey: '',
  village: '',
  area: '',
  recordNo: '',
  issueDate: '',
};
const demoForm: FormData = {
  owner: 'Meera Krishnan',
  survey: '48/2B',
  village: 'Devanahalli',
  area: '1.84',
  recordNo: 'RTC-2040-23',
  issueDate: '2023-01-18',
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    };
  }
  interface Document {
    modelContext?: {
      registerTool: (
        tool: unknown,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

export default function Home() {
  const [records, setRecords] = useState(seedRecords);
  const [profile, setProfile] = useState<Profile>('official');
  const [workspace, setWorkspace] = useState<
    'registry' | 'review' | 'proofs' | 'help'
  >('registry');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [form, setForm] = useState<FormData>(blankForm);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('eng');
  const [enhanceScan, setEnhanceScan] = useState(true);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [fieldConfidence, setFieldConfidence] = useState<FieldConfidence>({
    owner: 0,
    survey: 0,
    village: 0,
    area: 0,
    recordNo: 0,
    issueDate: 0,
  });
  const [ocrPass, setOcrPass] = useState('Preparing image');
  const [progress, setProgress] = useState(0);
  const [currentId, setCurrentId] = useState('');
  const [hash, setHash] = useState('');
  const [anchoredHash, setAnchoredHash] = useState('');
  const [txHash, setTxHash] = useState('');
  const [proof, setProof] = useState<ProofType>('local');
  const [signer, setSigner] = useState('');
  const [chainStatus, setChainStatus] = useState<ChainStatus>('idle');
  const [verifyState, setVerifyState] = useState<'idle' | 'valid' | 'invalid'>(
    'idle',
  );
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    if (dialogOpen && !modalRef.current?.open) modalRef.current?.showModal();
  }, [dialogOpen]);
  const ocrController = useRef<AbortController | null>(null);
  const flowVersion = useRef(0);

  useEffect(
    () => () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    },
    [fileUrl],
  );
  useEffect(
    () => () => {
      ocrController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    if (records === seedRecords) return;
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [records]);

  function updateForm(next: React.SetStateAction<FormData>) {
    setVerifyState('idle');
    setNotice('');
    setHash('');
    setFieldConfidence(scoreFields(blankForm, 0));
    setForm(next);
  }
  function beginOperation() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setAnchorBusy(true);
    return true;
  }
  function finishOperation() {
    busyRef.current = false;
    setAnchorBusy(false);
  }
  function closeDialog() {
    if (busyRef.current) return;
    ocrController.current?.abort();
    flowVersion.current++;
    setDialogOpen(false);
  }
  function exportRecords() {
    if (!canManage(profile)) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              schema: 'bhoomisetu-session-export-v1',
              exportedAt: new Date().toISOString(),
              warning:
                'Session export, not an authoritative registry backup. No document images included.',
              records,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bhoomisetu-session.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (workspace !== 'review' || record.status === 'Needs review') &&
          (workspace !== 'proofs' || Boolean(record.txHash)) &&
          [
            record.id,
            record.owner,
            record.survey,
            record.village,
            record.recordNo,
          ].some((value) =>
            value.toLowerCase().includes(query.trim().toLowerCase()),
          ),
      ),
    [query, records, workspace],
  );

  const conflicts = useMemo(
    () =>
      records.filter(
        (record) =>
          normalizeParcel(record.survey) === normalizeParcel(form.survey) &&
          normalizeParcel(record.village) === normalizeParcel(form.village) &&
          record.id !== currentId,
      ),
    [form.survey, form.village, currentId, records],
  );
  const requiredComplete = validationErrors(form).length === 0;

  const resetFlow = useCallback(() => {
    if (busyRef.current) return;
    flowVersion.current++;
    ocrController.current?.abort();
    setStep('upload');
    setForm(blankForm);
    setFileName('');
    setFileUrl('');
    setOcrText('');
    setProgress(0);
    setOcrConfidence(0);
    setFieldConfidence({
      owner: 0,
      survey: 0,
      village: 0,
      area: 0,
      recordNo: 0,
      issueDate: 0,
    });
    setOcrPass('Preparing image');
    setCurrentId('');
    setHash('');
    setAnchoredHash('');
    setTxHash('');
    setProof('local');
    setSigner('');
    setChainStatus('idle');
    setVerifyState('idle');
    setNotice('');
  }, []);

  function openNew() {
    if (busyRef.current || !canManage(profile)) return;
    resetFlow();
    setDialogOpen(true);
  }

  const loadSample = useCallback(() => {
    setFileName('sample-rtc-record.jpg');
    setForm(demoForm);
    setOcrText(
      'RECORD OF RIGHTS · Owner: Meera Krishnan · Survey No: 48/2B · Village: Devanahalli · Extent: 1.84 acres · RTC-2040-23 · Issued 18/01/2023',
    );
    setOcrConfidence(0);
    setFieldConfidence(scoreFields(blankForm, 0));
    setProgress(100);
    setNotice(
      'Synthetic sample: prefilled fields, not a live OCR result. The parcel conflict is intentional.',
    );
    setStep('review');
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_land_record_digitization',
          title: 'Start land record digitization',
          description:
            'Open the visible digitization workflow with the built-in sample record prepared for human review.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async () => {
            if (!canManage(profile))
              return { status: 'not_available_for_profile' };
            if (busyRef.current) return { status: 'busy' };
            resetFlow();
            loadSample();
            setDialogOpen(true);
            return {
              status: 'ready_for_review',
              survey_number: demoForm.survey,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [resetFlow, loadSample, profile]);

  async function runOcr(file: File) {
    if (!canManage(profile)) return;
    if (
      !['image/png', 'image/jpeg'].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setNotice(
        'Use a PNG or JPEG image smaller than 12 MB. PDF support is intentionally deferred.',
      );
      setStep('upload');
      return;
    }
    ocrController.current?.abort();
    const controller = new AbortController();
    ocrController.current = controller;
    const version = ++flowVersion.current;
    const active = () =>
      !controller.signal.aborted && flowVersion.current === version;
    setForm(blankForm);
    setOcrText('');
    setFileUrl('');
    setOcrConfidence(0);
    setFieldConfidence(scoreFields(blankForm, 0));
    setFileName(file.name);
    setStep('processing');
    setProgress(3);
    setOcrPass('Preparing scan');
    setNotice('Reading document locally in your browser…');
    try {
      const processed = await enhanceImage(file, enhanceScan);
      if (!active()) return;
      setFileUrl(URL.createObjectURL(processed));
      setProgress(9);
      setOcrPass('Recognizing text');
      const primary = await recognizeScan(
        processed,
        ocrLanguage,
        controller.signal,
        (value) => {
          if (active()) setProgress(Math.max(12, Math.round(value * 82)));
        },
      );
      let best = primary;
      if (enhanceScan && primary.confidence < 68 && active()) {
        setOcrPass('Low-confidence scan · comparing unenhanced image');
        setProgress(84);
        try {
          const original = await enhanceImage(file, false);
          const fallback = await recognizeScan(
            original,
            ocrLanguage,
            controller.signal,
            (value) => {
              if (active()) setProgress(84 + Math.round(value * 14));
            },
          );
          if (fallback.confidence > primary.confidence) {
            best = fallback;
            if (active()) setFileUrl(URL.createObjectURL(original));
          }
        } catch {
          /* Preserve a completed first pass if the comparison fails. */
        }
      }
      if (!active()) return;
      const text = best.text || '';
      const parsed = parseOcr(text);
      const confidence = Math.max(
        0,
        Math.min(100, Math.round(best.confidence || 0)),
      );
      setOcrText(text);
      setForm(parsed);
      setOcrConfidence(confidence);
      setFieldConfidence(scoreFields(parsed, confidence));
      setProgress(100);
      setOcrPass('Extraction complete');
      setNotice(
        text.trim()
          ? 'OCR is a draft, not validation. Review every value and confirm that the source area is in acres; no unit conversion is performed.'
          : 'No clear text found. Enter the fields manually.',
      );
    } catch {
      if (!active()) return;
      setFileUrl(URL.createObjectURL(file));
      setOcrConfidence(0);
      setOcrPass('Manual review required');
      setNotice(
        'OCR failed or exceeded its time limit. Enter the fields manually; no extraction result was claimed.',
      );
    }
    if (active()) setStep('review');
  }

  async function approveRecord() {
    if (
      !canManage(profile) ||
      !requiredComplete ||
      conflicts.length ||
      !beginOperation()
    )
      return;
    try {
      const newHash = await hashRecord(form);
      const id =
        currentId || `LR-${new Date().getFullYear()}-${crypto.randomUUID()}`;
      const record: LandRecord = {
        ...form,
        id,
        hash: newHash,
        status: 'Validated',
        updated: 'Just now',
      };
      setCurrentId(id);
      setHash(newHash);
      setRecords((old) => [record, ...old.filter((item) => item.id !== id)]);
      setStep('approved');
      setNotice(
        'Basic field and duplicate checks passed. This is not legal title validation.',
      );
    } catch {
      setNotice(
        'The fingerprint could not be computed. No record was approved.',
      );
    } finally {
      finishOperation();
    }
  }

  async function anchorOnPolygon() {
    if (!canManage(profile) || !beginOperation()) return;
    setNotice('Waiting for wallet confirmation…');
    let submittedTransaction = '';
    try {
      if (!window.ethereum) throw new Error('NO_WALLET');
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: AMOY_CHAIN_ID }],
        });
      } catch {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: AMOY_CHAIN_ID,
              chainName: 'Polygon Amoy',
              nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
              rpcUrls: [AMOY_RPC],
              blockExplorerUrls: [AMOY_EXPLORER],
            },
          ],
        });
      }
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (!accounts[0] || !/^0x[0-9a-f]{40}$/i.test(accounts[0]))
        throw new Error('NO_ACCOUNT');
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (
        typeof chainId !== 'string' ||
        chainId.toLowerCase() !== AMOY_CHAIN_ID
      )
        throw new Error('WRONG_CHAIN');
      const transaction = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: accounts[0],
            to: accounts[0],
            value: '0x0',
            data: `0x${hash}`,
          },
        ],
      })) as string;
      if (!/^0x[0-9a-f]{64}$/i.test(transaction))
        throw new Error('INVALID_TRANSACTION');
      submittedTransaction = transaction;
      setRecords((old) =>
        old.map((record) =>
          record.id === currentId
            ? {
                ...record,
                status: 'Pending',
                hash,
                txHash: transaction,
                proof: 'polygon',
                chainStatus: 'pending',
              }
            : record,
        ),
      );
      setTxHash(transaction);
      setAnchoredHash(hash);
      setProof('polygon');
      setChainStatus('pending');
      setNotice(
        'Transaction submitted. Waiting for an Amoy block confirmation…',
      );
      const receipt = await waitForReceipt(transaction);
      if (receipt.status !== '0x1') throw new Error('TRANSACTION_REVERTED');
      setChainStatus('confirmed');
      setStep('proof');
      setRecords((old) =>
        old.map((record) =>
          record.id === currentId
            ? {
                ...record,
                status: 'Anchored',
                hash,
                txHash: transaction,
                proof: 'polygon',
                chainStatus: 'confirmed',
              }
            : record,
        ),
      );
      setNotice(
        `Confirmed on Polygon Amoy in block ${Number.parseInt(receipt.blockNumber, 16).toLocaleString()}.`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_WALLET')
        setNotice(
          'No browser wallet found. Install MetaMask in a supported browser. The record remains validated.',
        );
      else if (
        submittedTransaction &&
        (!(error instanceof Error) || error.message !== 'TRANSACTION_REVERTED')
      ) {
        setChainStatus('pending');
        setStep('proof');
        setNotice(
          'Transaction was submitted, but confirmation could not be established yet. Check the explorer before treating it as anchored.',
        );
      } else {
        setChainStatus('failed');
        if (submittedTransaction) {
          setStep('proof');
          setRecords((old) =>
            old.map((record) =>
              record.id === currentId
                ? { ...record, status: 'Validated', chainStatus: 'failed' }
                : record,
            ),
          );
        }
        setNotice(
          'The wallet transaction was rejected or failed. The record remains validated and no anchor was recorded.',
        );
      }
    } finally {
      finishOperation();
    }
  }

  async function createWalletAttestation() {
    if (!canManage(profile) || !beginOperation()) return;
    setNotice('Waiting for your wallet signature…');
    try {
      if (!window.ethereum) throw new Error('NO_WALLET');
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const account = accounts[0];
      if (!account) throw new Error('NO_ACCOUNT');
      const message = attestationMessage(currentId, hash);
      const signature = (await window.ethereum.request({
        method: 'personal_sign',
        params: [utf8ToHex(message), account],
      })) as string;
      if (!/^0x[0-9a-f]{130}$/i.test(signature))
        throw new Error('INVALID_SIGNATURE');
      setTxHash(signature);
      setSigner(account);
      setAnchoredHash(hash);
      setProof('wallet');
      setChainStatus('confirmed');
      setVerifyState('idle');
      setStep('proof');
      setRecords((old) =>
        old.map((record) =>
          record.id === currentId
            ? {
                ...record,
                status: 'Attested',
                hash,
                txHash: signature,
                proof: 'wallet',
                signer: account,
              }
            : record,
        ),
      );
      setNotice(
        'Gasless attestation created. No blockchain transaction or network fee was used.',
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_WALLET')
        setNotice(
          'No browser wallet found. Install MetaMask to create a gasless attestation.',
        );
      else
        setNotice(
          'The signature request was rejected or could not be completed. No proof was created.',
        );
    } finally {
      finishOperation();
    }
  }

  async function verifyIntegrity() {
    if (!canManage(profile) || !beginOperation()) return;
    setVerifyState('idle');
    try {
      const currentHash = await hashRecord(form);
      setHash(currentHash);
      if (proof === 'wallet') {
        if (!window.ethereum) {
          setVerifyState('idle');
          setNotice(
            'A browser wallet is required to recover and verify the signer.',
          );
          return;
        }
        try {
          const recovered = (await window.ethereum.request({
            method: 'personal_ecRecover',
            params: [
              utf8ToHex(attestationMessage(currentId, anchoredHash)),
              txHash,
            ],
          })) as string;
          const signatureMatches =
            recovered.toLowerCase() === signer.toLowerCase();
          const recordMatches = currentHash === anchoredHash;
          setVerifyState(
            signatureMatches && recordMatches ? 'valid' : 'invalid',
          );
          setNotice(
            signatureMatches && recordMatches
              ? `Signature valid. Approved by ${shortAddress(recovered)} and the record fingerprint is unchanged.`
              : !recordMatches
                ? 'The record has changed since it was signed.'
                : 'The signature does not recover to the recorded approving wallet.',
          );
        } catch {
          setVerifyState('idle');
          setNotice(
            'The wallet could not recover this signature. No verification result was claimed.',
          );
        }
        return;
      }
      if (proof === 'polygon') {
        setNotice('Reading the transaction back from Polygon Amoy…');
        try {
          const [transaction, receipt] = await Promise.all([
            readAmoyTransaction(txHash),
            amoyRpc<AmoyReceipt>('eth_getTransactionReceipt', [txHash]),
          ]);
          if (!receipt) {
            setChainStatus('pending');
            setVerifyState('idle');
            setRecords((old) =>
              old.map((record) =>
                record.id === currentId
                  ? { ...record, status: 'Pending', chainStatus: 'pending' }
                  : record,
              ),
            );
            setNotice(
              'No confirmed receipt was returned. Retry shortly or check the explorer.',
            );
            return;
          }
          if (receipt.status !== '0x1') {
            setRecords((old) =>
              old.map((record) =>
                record.id === currentId
                  ? { ...record, status: 'Validated', chainStatus: 'failed' }
                  : record,
              ),
            );
            setChainStatus('failed');
            setVerifyState('invalid');
            setNotice(
              'The blockchain transaction failed and cannot anchor this record.',
            );
            return;
          }
          setChainStatus('confirmed');
          const chainHashMatches =
            transaction?.input?.toLowerCase() ===
            `0x${anchoredHash}`.toLowerCase();
          setVerifyState(
            currentHash === anchoredHash && chainHashMatches
              ? 'valid'
              : 'invalid',
          );
          if (chainHashMatches)
            setRecords((old) =>
              old.map((record) =>
                record.id === currentId
                  ? { ...record, status: 'Anchored', chainStatus: 'confirmed' }
                  : record,
              ),
            );
          setNotice(
            currentHash !== anchoredHash
              ? 'The current record has changed since approval.'
              : chainHashMatches
                ? `On-chain input independently matches the approved fingerprint in block ${Number.parseInt(receipt.blockNumber, 16).toLocaleString()}.`
                : 'The Amoy transaction input does not match this record fingerprint.',
          );
        } catch {
          setVerifyState('idle');
          setNotice(
            'Amoy could not be reached. No verification result was claimed; retry when the network is available.',
          );
        }
        return;
      }
      setVerifyState(currentHash === anchoredHash ? 'valid' : 'invalid');
      setNotice(
        'Compared with the stored offline demo proof. No blockchain lookup was performed.',
      );
    } catch {
      setVerifyState('idle');
      setNotice('Verification could not complete. No success is claimed.');
    } finally {
      finishOperation();
    }
  }

  async function openRecord(record?: LandRecord) {
    if (busyRef.current || !canManage(profile)) return;
    if (!record) {
      setNotice('No matching records are available yet.');
      return;
    }
    resetFlow();
    const version = flowVersion.current;
    setForm({
      owner: record.owner,
      survey: record.survey,
      village: record.village,
      area: record.area,
      recordNo: record.recordNo,
      issueDate: record.issueDate,
    });
    setCurrentId(record.id);
    setFileName('Source image is not retained');
    setHash(record.hash || '');
    setAnchoredHash(record.hash || '');
    setTxHash(record.txHash || '');
    setProof(record.proof || 'local');
    setSigner(record.signer || '');
    setChainStatus(
      record.chainStatus ||
        (record.status === 'Anchored' || record.status === 'Attested'
          ? 'confirmed'
          : 'idle'),
    );
    setStep('details');
    setDialogOpen(true);
    const recordHash =
      record.hash || (await hashRecord(record).catch(() => ''));
    if (version === flowVersion.current) setHash(recordHash);
  }

  function changeProfile(next: Profile) {
    if (busyRef.current) return;
    closeDialog();
    resetFlow();
    setQuery('');
    setWorkspace('registry');
    setProfile(next);
  }
  function navigate(next: typeof workspace) {
    if (busyRef.current) return;
    closeDialog();
    setQuery('');
    setNotice('');
    setWorkspace(next);
  }
  const selectedRecord = records.find((record) => record.id === currentId);

  return (
    <main className="min-h-screen bg-[#f3f6f8] text-slate-950">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/10 bg-[#071b2b] px-4 text-white shadow-sm md:px-7">
        <div className="flex items-center gap-3">
          <div className="hidden h-9 w-9 place-items-center rounded-xl bg-teal-400 text-[#071b2b] shadow-[0_0_22px_rgba(45,212,191,.24)] sm:grid">
            <MapPinned className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">BhoomiSetu</p>
            <p className="hidden text-xs text-slate-400 sm:block">
              Land Records Intelligence
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-teal-400/15 text-teal-200 sm:flex">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <Label
              htmlFor="profile-selector"
              className="mb-1 block text-xs text-slate-400"
            >
              Demo profile
            </Label>
            <select
              id="profile-selector"
              value={profile}
              disabled={anchorBusy}
              onChange={(event) => changeProfile(event.target.value as Profile)}
              className="max-w-[155px] rounded-lg border border-white/20 bg-[#102c3f] px-2 py-1 text-sm text-white focus:outline-2 focus:outline-teal-300 sm:max-w-48"
            >
              <option value="official">Government official</option>
              <option value="public">Normal user</option>
              <option value="broker">Broker</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white p-3 lg:w-60 lg:border-b-0 lg:border-r lg:p-4">
          <nav
            aria-label="Workspace navigation"
            className="flex gap-1 overflow-x-auto lg:block lg:space-y-1"
          >
            {canManage(profile) ? (
              <>
                <NavItem
                  icon={LayoutDashboard}
                  label="All records"
                  active={workspace === 'registry'}
                  onClick={() => navigate('registry')}
                />
                <NavItem
                  icon={FileCheck2}
                  label="Review queue"
                  count={String(
                    records.filter((record) => record.status === 'Needs review')
                      .length,
                  )}
                  active={workspace === 'review'}
                  onClick={() => navigate('review')}
                />
                <NavItem
                  icon={Fingerprint}
                  label="Proof tracker"
                  active={workspace === 'proofs'}
                  onClick={() => navigate('proofs')}
                />
                <NavItem
                  icon={Upload}
                  label="Digitize record"
                  onClick={openNew}
                />
                <NavItem
                  icon={Download}
                  label="Export records"
                  onClick={exportRecords}
                />
              </>
            ) : (
              <NavItem
                icon={profile === 'broker' ? Search : ShieldCheck}
                label={
                  profile === 'broker' ? 'Parcel lookup' : 'Ownership check'
                }
                active={workspace !== 'help'}
                onClick={() => navigate('registry')}
              />
            )}
            <NavItem
              icon={CircleHelp}
              label="Help & access"
              active={workspace === 'help'}
              onClick={() => navigate('help')}
            />
          </nav>
          <div className="mt-8 hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:block">
            <ShieldCheck className="mb-3 h-5 w-5 text-teal-700" />
            <p className="text-sm font-semibold">
              {profile === 'official'
                ? 'Registry administration'
                : profile === 'broker'
                  ? 'Read-only parcel lookup'
                  : 'Exact-match verification'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {profile === 'official'
                ? 'Review records and track signatures or blockchain confirmations in one place.'
                : profile === 'broker'
                  ? 'Find recorded owners by parcel. Editing and registry export are not available in this view.'
                  : 'Verify the details you already have without browsing other records.'}
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
          <div className="mx-auto max-w-[1280px]">
            {workspace === 'help' ? (
              <AccessGuide />
            ) : !canManage(profile) ? (
              <OwnershipPanel
                key={profile}
                profile={profile}
                records={records}
              />
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="mb-1 text-sm font-semibold text-teal-700">
                      Government workspace
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                      {workspace === 'review'
                        ? 'Records awaiting review'
                        : workspace === 'proofs'
                          ? 'Record proof tracker'
                          : 'Land record registry'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Digitize, validate, and verify every approved record.
                    </p>
                  </div>
                  <Button
                    onClick={openNew}
                    className="h-11 rounded-xl bg-[#0b766d] px-5 text-white shadow-sm hover:bg-[#09665f]"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Digitize new record
                  </Button>
                </div>
                {!dialogOpen && notice && (
                  <p className="mt-4 text-sm text-slate-600" aria-live="polite">
                    {notice}
                  </p>
                )}
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <Metric
                    icon={FileSearch}
                    label="Total records"
                    value={String(records.length).padStart(3, '0')}
                    detail="Records available in this session"
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="Validated"
                    value={String(
                      records.filter((r) => r.status !== 'Needs review').length,
                    ).padStart(3, '0')}
                    detail="Registry quality checks passed"
                    tone="teal"
                  />
                  <Metric
                    icon={FileCheck2}
                    label="Needs review"
                    value={String(
                      records.filter((r) => r.status === 'Needs review').length,
                    ).padStart(2, '0')}
                    detail="Requires human investigation"
                    tone="amber"
                  />
                </div>
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,.04)]">
                  <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold">
                        {workspace === 'review'
                          ? 'Review queue'
                          : workspace === 'proofs'
                            ? 'Signatures & blockchain transactions'
                            : 'Recent records'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Search by owner, survey number, village, or record ID
                      </p>
                    </div>
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search the registry…"
                        className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Record</th>
                          <th className="px-5 py-3">Owner</th>
                          <th className="px-5 py-3">Parcel</th>
                          <th className="px-5 py-3">Area</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Updated</th>
                          <th className="px-5 py-3">
                            <span className="sr-only">Open</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((record) => (
                          // The View button provides the keyboard equivalent of row clicking.
                          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
                          <tr
                            onClick={() => void openRecord(record)}
                            key={record.id}
                            className="group cursor-pointer transition-colors hover:bg-slate-50"
                          >
                            <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openRecord(record);
                                }}
                                className="rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-teal-600"
                              >
                                {record.id}
                              </button>
                            </td>
                            <td className="px-5 py-4 font-semibold">
                              {record.owner}
                            </td>
                            <td className="px-5 py-4">
                              <span className="font-medium">
                                {record.survey}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {record.village}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              {record.area} ac
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={record.status} />
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-500">
                              {record.updated}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openRecord(record);
                                }}
                                aria-label={`View record ${record.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-teal-800 hover:bg-teal-50"
                              >
                                View
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filtered.length === 0 && (
                      <div className="px-5 py-12 text-center text-sm text-slate-500">
                        {query
                          ? `No records match “${query}”.`
                          : workspace === 'proofs'
                            ? 'No proofs yet. Open a validated record to create a wallet signature or a Polygon anchor.'
                            : workspace === 'review'
                              ? 'No records are awaiting review.'
                              : 'No records available.'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {dialogOpen && canManage(profile) && (
        <dialog
          ref={modalRef}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          aria-labelledby="record-dialog-title"
          className="fixed inset-0 m-auto max-h-[92vh] w-[min(1100px,calc(100%-1.5rem))] max-w-none overflow-y-auto rounded-2xl bg-white p-0 text-slate-950 shadow-2xl ring-1 ring-slate-950/10 backdrop:bg-slate-950/35 backdrop:backdrop-blur-sm"
        >
          <button
            onClick={closeDialog}
            disabled={anchorBusy}
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <XCircle className="h-5 w-5" />
          </button>
          <header className="border-b border-slate-200 px-5 py-4 pr-14">
            <h2
              id="record-dialog-title"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <Fingerprint className="h-5 w-5 text-teal-700" />
              {step === 'upload'
                ? 'Digitize a land record'
                : currentId || 'New land record'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{stepLabel(step)}</p>
          </header>
          <fieldset
            disabled={anchorBusy}
            className="min-w-0 border-0 px-5 py-5 md:px-6"
          >
            {step !== 'details' && <StepRail step={step} />}
            {step === 'details' && selectedRecord && (
              <div className="py-4">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {selectedRecord.owner}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Record details · {selectedRecord.id}
                    </p>
                  </div>
                  <StatusBadge status={selectedRecord.status} />
                </div>
                <dl className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Owner name', selectedRecord.owner],
                    ['Survey / parcel', selectedRecord.survey],
                    ['Village / locality', selectedRecord.village],
                    ['Area', selectedRecord.area + ' acres'],
                    ['Record number', selectedRecord.recordNo],
                    ['Issue date', selectedRecord.issueDate],
                    ['Last updated', selectedRecord.updated],
                    [
                      'Proof method',
                      selectedRecord.proof === 'polygon'
                        ? 'Polygon Amoy'
                        : selectedRecord.proof === 'wallet'
                          ? 'Wallet signature'
                          : 'No proof recorded',
                    ],
                    ['Review state', selectedRecord.status],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-slate-500">{label}</dt>
                      <dd className="mt-1 break-words text-base font-semibold">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-sm font-semibold text-slate-600">
                    Record fingerprint
                  </h4>
                  <p className="mt-2 break-all font-mono text-sm">
                    {hash || 'Computing fingerprint…'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    A fingerprint alone is not a confirmed blockchain proof.
                  </p>
                  {selectedRecord.txHash && (
                    <>
                      <h4 className="mt-4 text-sm font-semibold text-slate-600">
                        Signature / transaction reference
                      </h4>
                      <p className="mt-2 break-all font-mono text-sm">
                        {selectedRecord.txHash}
                      </p>
                    </>
                  )}
                  {selectedRecord.signer && (
                    <p className="mt-3 break-all text-sm">
                      Signing wallet: {selectedRecord.signer}
                    </p>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={closeDialog}>
                    Close
                  </Button>
                  <Button
                    disabled={!hash}
                    className="bg-teal-700 text-white hover:bg-teal-800"
                    onClick={() =>
                      setStep(
                        selectedRecord.txHash
                          ? 'proof'
                          : selectedRecord.status === 'Needs review'
                            ? 'review'
                            : 'approved',
                      )
                    }
                  >
                    {selectedRecord.txHash
                      ? 'Inspect & verify proof'
                      : selectedRecord.status === 'Needs review'
                        ? 'Review this record'
                        : 'Create record proof'}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {step === 'upload' && (
              <UploadStage
                onFile={(file) => void runOcr(file)}
                onSample={loadSample}
                fileInput={fileInput}
                language={ocrLanguage}
                setLanguage={setOcrLanguage}
                enhance={enhanceScan}
                setEnhance={setEnhanceScan}
                error={notice}
              />
            )}
            {step === 'processing' && (
              <>
                <ProcessingStage
                  progress={progress}
                  fileName={fileName}
                  pass={ocrPass}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    ocrController.current?.abort();
                    flowVersion.current++;
                    setStep('review');
                    setNotice(
                      'OCR stopped. Enter all fields manually; no extraction result was claimed.',
                    );
                  }}
                >
                  Stop OCR and enter manually
                </Button>
              </>
            )}
            {step === 'review' && (
              <ReviewStage
                form={form}
                setForm={updateForm}
                fileName={fileName}
                fileUrl={fileUrl}
                ocrText={ocrText}
                ocrConfidence={ocrConfidence}
                fieldConfidence={fieldConfidence}
                conflicts={conflicts}
                requiredComplete={requiredComplete}
                notice={notice}
                onApprove={() => void approveRecord()}
                onReset={resetFlow}
              />
            )}
            {step === 'approved' && (
              <ApprovedStage
                hash={hash}
                form={form}
                notice={notice}
                busy={anchorBusy}
                onAttest={() => void createWalletAttestation()}
                onAnchor={() => void anchorOnPolygon()}
              />
            )}
            {step === 'proof' && (
              <ProofStage
                form={form}
                setForm={updateForm}
                hash={hash}
                txHash={txHash}
                proof={proof}
                signer={signer}
                chainStatus={chainStatus}
                verifyState={verifyState}
                notice={notice}
                onVerify={() => void verifyIntegrity()}
                onDone={closeDialog}
              />
            )}
          </fieldset>
        </dialog>
      )}
    </main>
  );
}

function UploadStage({
  onFile,
  onSample,
  fileInput,
  language,
  setLanguage,
  enhance,
  setEnhance,
  error,
}: {
  onFile: (file: File) => void;
  onSample: () => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  language: OcrLanguage;
  setLanguage: (value: OcrLanguage) => void;
  enhance: boolean;
  setEnhance: (value: boolean) => void;
  error: string;
}) {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Languages className="h-4 w-4 text-teal-700" />
            Document language
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as OcrLanguage)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none focus:border-teal-500"
          >
            <option value="eng">English</option>
            <option value="eng+kan">English + Kannada</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setEnhance(!enhance)}
          aria-pressed={enhance}
          className={`rounded-xl border p-3 text-left transition ${enhance ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <WandSparkles className="h-4 w-4 text-teal-700" />
            Scan enhancement
          </span>
          <span className="mt-2 flex items-center justify-between text-sm font-medium">
            <span>Contrast, grayscale, upscale</span>
            <span
              className={`rounded-full px-2 py-1 text-xs ${enhance ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {enhance ? 'On' : 'Off'}
            </span>
          </span>
        </button>
      </div>
      <button
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className="group flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-teal-500 hover:bg-teal-50/40"
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-1">
          <ScanLine className="h-6 w-6" />
        </div>
        <p className="mt-5 font-semibold">Drop a scanned record here</p>
        <p className="mt-1 text-sm text-slate-500">
          PNG or JPEG · typed document · up to 12 MB
        </p>
        <span className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Choose document
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or use the guaranteed demo path
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Button
        onClick={onSample}
        variant="outline"
        className="h-11 w-full rounded-xl border-teal-200 text-teal-800 hover:bg-teal-50"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Load sample RTC record
      </Button>
    </div>
  );
}

function ProcessingStage({
  progress,
  fileName,
  pass,
}: {
  progress: number;
  fileName: string;
  pass: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-teal-50 text-teal-700">
        <FileSearch className="h-8 w-8" />
        <LoaderCircle className="absolute -right-2 -top-2 h-6 w-6 animate-spin text-teal-600" />
      </div>
      <h3 className="mt-6 text-xl font-bold">Reading the document</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {pass}. OCR runs locally; the scan is not sent to a third-party OCR
        service.
      </p>
      <div className="mt-7 w-full">
        <div className="mb-2 flex justify-between text-xs">
          <span className="truncate text-slate-500">{fileName}</span>
          <span className="font-semibold text-teal-700">{progress}%</span>
        </div>
        <progress
          value={progress}
          max={100}
          className="h-2 w-full overflow-hidden rounded-full accent-teal-600"
        />
      </div>
    </div>
  );
}

function ReviewStage({
  form,
  setForm,
  fileName,
  fileUrl,
  ocrText,
  ocrConfidence,
  fieldConfidence,
  conflicts,
  requiredComplete,
  notice,
  onApprove,
  onReset,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  fileName: string;
  fileUrl: string;
  ocrText: string;
  ocrConfidence: number;
  fieldConfidence: FieldConfidence;
  conflicts: LandRecord[];
  requiredComplete: boolean;
  notice: string;
  onApprove: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Source preview</p>
            <p className="max-w-52 truncate text-xs text-slate-500">
              {fileName}
            </p>
          </div>
          <Badge variant="outline">Review required</Badge>
        </div>
        <div className="flex min-h-[440px] items-center justify-center p-5">
          {fileUrl ? (
            <Image
              unoptimized
              src={fileUrl}
              alt="OCR-enhanced land record"
              width={700}
              height={900}
              className="max-h-[430px] w-auto max-w-full rounded-lg object-contain shadow-lg"
            />
          ) : fileName === 'sample-rtc-record.jpg' ? (
            <SampleDocument />
          ) : (
            <p className="text-sm text-slate-500">
              No source image is retained for this record.
            </p>
          )}
        </div>
        {ocrText && (
          <details className="border-t border-slate-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              View raw OCR text
            </summary>
            <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-500">
              {ocrText}
            </p>
          </details>
        )}
      </div>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">Confirm extracted fields</h3>
            <p className="mt-1 text-sm text-slate-500">
              Review all fields. OCR confidence does not establish ownership or
              authenticity.
            </p>
          </div>
          <ConfidenceBadge value={ocrConfidence} large />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-teal-700 shadow-sm">
            <ScanLine className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">
              OCR quality assessment
            </p>
            <p className="truncate text-xs text-slate-500">{notice}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="Owner name"
            name="owner"
            value={form.owner}
            confidence={fieldConfidence.owner}
            setForm={setForm}
          />
          <Field
            label="Survey number"
            name="survey"
            value={form.survey}
            confidence={fieldConfidence.survey}
            setForm={setForm}
          />
          <Field
            label="Village"
            name="village"
            value={form.village}
            confidence={fieldConfidence.village}
            setForm={setForm}
          />
          <Field
            label="Area (acres)"
            name="area"
            value={form.area}
            confidence={fieldConfidence.area}
            setForm={setForm}
            type="number"
          />
          <Field
            label="Record number"
            name="recordNo"
            value={form.recordNo}
            confidence={fieldConfidence.recordNo}
            setForm={setForm}
          />
          <Field
            label="Issue date"
            name="issueDate"
            value={form.issueDate}
            confidence={fieldConfidence.issueDate}
            setForm={setForm}
            type="date"
          />
        </div>
        <div
          className={`mt-5 rounded-xl border p-4 ${conflicts.length ? 'border-amber-200 bg-amber-50' : requiredComplete ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}
        >
          {conflicts.length ? (
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Possible parcel conflict
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Survey {form.survey} in {form.village} already appears under{' '}
                  {conflicts[0].owner} with {conflicts[0].area} acres.
                  Investigate before approval; change identifiers only when
                  supported by the source.
                </p>
              </div>
            </div>
          ) : requiredComplete ? (
            <div className="flex gap-3">
              <ClipboardCheck className="h-5 w-5 text-teal-700" />
              <div>
                <p className="text-sm font-semibold text-teal-900">
                  Basic checks passed
                </p>
                <p className="mt-1 text-xs text-teal-800">
                  Required fields, area, date, identifier format, and duplicate
                  parcel checks completed.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <CircleDashed className="h-5 w-5 text-slate-500" />
              <p className="text-sm text-slate-600">
                {validationErrors(form)[0] || 'Review every extracted field.'}
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start over
          </Button>
          <Button
            disabled={!requiredComplete || !!conflicts.length}
            onClick={onApprove}
            className="bg-[#0b766d] text-white hover:bg-[#09665f]"
          >
            <Check className="mr-2 h-4 w-4" />
            Approve validated record
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApprovedStage({
  hash,
  form,
  notice,
  busy,
  onAttest,
  onAnchor,
}: {
  hash: string;
  form: FormData;
  notice: string;
  busy: boolean;
  onAttest: () => void;
  onAnchor: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-2xl font-bold">Record validated</h3>
        <p className="mt-2 text-sm text-slate-500">
          Choose a gasless approval or create a public Polygon blockchain
          anchor.
        </p>
      </div>
      <div className="mt-7 rounded-2xl border border-slate-200 bg-[#071b2b] p-5 text-white">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">
            Record fingerprint
          </p>
          <Fingerprint className="h-5 w-5 text-teal-300" />
        </div>
        <p className="mt-3 break-all font-mono text-sm leading-6 text-slate-200">
          {hash}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
          <div>
            <span className="text-slate-400">Owner</span>
            <p className="mt-1 font-semibold">{form.owner}</p>
          </div>
          <div>
            <span className="text-slate-400">Parcel</span>
            <p className="mt-1 font-semibold">{form.survey}</p>
          </div>
          <div>
            <span className="text-slate-400">Area</span>
            <p className="mt-1 font-semibold">{form.area} ac</p>
          </div>
        </div>
      </div>
      {notice && (
        <p className="mt-4 text-center text-sm text-amber-700">{notice}</p>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          onClick={onAttest}
          disabled={busy}
          className="h-auto min-h-16 justify-start rounded-xl bg-[#0b766d] px-4 py-3 text-left text-white hover:bg-[#09665f]"
        >
          {busy ? (
            <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          ) : (
            <Wallet className="mr-3 h-5 w-5" />
          )}
          <span>
            <span className="block font-semibold">
              Sign gasless wallet attestation
            </span>
            <span className="block text-xs font-normal text-teal-100">
              Instant approval · no POL required
            </span>
          </span>
        </Button>
        <Button
          onClick={onAnchor}
          disabled={busy}
          className="h-auto min-h-16 justify-start rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-violet-950 shadow-none hover:bg-violet-100"
        >
          <Blocks className="mr-3 h-5 w-5 text-violet-700" />
          <span>
            <span className="block font-semibold">Anchor on Polygon Amoy</span>
            <span className="block text-xs font-normal text-violet-700">
              Public on-chain proof · test POL gas
            </span>
          </span>
        </Button>
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        Only the fingerprint is sent on-chain. Wallet signatures additionally
        bind the record ID. Original documents are not hashed or stored. Neither
        method proves legal ownership.
      </p>
    </div>
  );
}

function ProofStage({
  form,
  setForm,
  hash,
  txHash,
  proof,
  signer,
  chainStatus,
  verifyState,
  notice,
  onVerify,
  onDone,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  hash: string;
  txHash: string;
  proof: ProofType;
  signer: string;
  chainStatus: ChainStatus;
  verifyState: 'idle' | 'valid' | 'invalid';
  notice: string;
  onVerify: () => void;
  onDone: () => void;
}) {
  const proofLabel =
    proof === 'wallet'
      ? 'Gasless wallet attestation'
      : proof === 'polygon'
        ? 'Polygon Amoy · Chain 80002'
        : 'Offline demo proof';
  const successTitle =
    proof === 'wallet'
      ? 'Fingerprint wallet-attested'
      : proof === 'polygon'
        ? 'Fingerprint anchored'
        : 'Demo proof created';
  const verifiedTitle =
    proof === 'wallet'
      ? 'Wallet signature verified'
      : proof === 'polygon'
        ? 'On-chain integrity verified'
        : 'Local integrity verified';
  const proofDescription =
    proof === 'wallet'
      ? 'The recorded wallet signature can be checked below. This is off-chain approval, not government authorization or proof of legal title.'
      : proof === 'polygon'
        ? 'Verification reads the transaction input back from Polygon Amoy.'
        : 'This fallback verifies local integrity only and is not a blockchain transaction.';
  return (
    <div className="mx-auto max-w-3xl py-6">
      <div
        className={`rounded-2xl border p-6 ${verifyState === 'invalid' || chainStatus === 'failed' ? 'border-red-200 bg-red-50' : chainStatus === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-teal-200 bg-teal-50'}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${verifyState === 'invalid' || chainStatus === 'failed' ? 'bg-red-100 text-red-700' : chainStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}
          >
            {verifyState === 'invalid' || chainStatus === 'failed' ? (
              <XCircle className="h-6 w-6" />
            ) : chainStatus === 'pending' ? (
              <LoaderCircle className="h-6 w-6 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  proof === 'polygon'
                    ? 'bg-violet-100 text-violet-800'
                    : proof === 'wallet'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200 text-slate-700'
                }
              >
                {proofLabel}
              </Badge>
              <Badge
                className={
                  chainStatus === 'confirmed'
                    ? 'bg-teal-100 text-teal-800'
                    : chainStatus === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }
              >
                {chainStatus === 'confirmed'
                  ? proof === 'wallet'
                    ? 'Signed'
                    : 'Confirmed'
                  : chainStatus === 'pending'
                    ? 'Pending'
                    : 'Failed'}
              </Badge>
            </div>
            <h3
              className={`mt-2 text-xl font-bold ${verifyState === 'invalid' ? 'text-red-950' : chainStatus === 'pending' ? 'text-amber-950' : 'text-teal-950'}`}
            >
              {verifyState === 'invalid'
                ? 'Record or proof mismatch detected'
                : verifyState === 'valid'
                  ? verifiedTitle
                  : chainStatus === 'pending'
                    ? 'Waiting for confirmation'
                    : chainStatus === 'failed'
                      ? 'Blockchain transaction failed'
                      : successTitle}
            </h3>
            <p
              className={`mt-1 text-sm ${verifyState === 'invalid' ? 'text-red-800' : chainStatus === 'pending' ? 'text-amber-800' : 'text-teal-800'}`}
            >
              {verifyState === 'invalid'
                ? 'The current record or approving signature does not match the approved snapshot.'
                : proofDescription}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_auto]">
        <div>
          {proof === 'wallet' && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Approving wallet
              </p>
              <p className="mt-2 break-all font-mono text-xs text-slate-700">
                {signer}
              </p>
            </>
          )}
          <p
            className={`${proof === 'wallet' ? 'mt-4 ' : ''}text-xs font-semibold uppercase tracking-wide text-slate-500`}
          >
            {proof === 'wallet'
              ? 'Wallet signature'
              : 'Transaction / proof reference'}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-slate-700">
            {txHash}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current fingerprint
          </p>
          <p className="mt-2 break-all font-mono text-xs text-slate-700">
            {hash}
          </p>
        </div>
        {proof === 'polygon' && (
          <a
            href={`${AMOY_EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            Explorer <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        )}
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Cryptographic verification</h4>
            <p className="mt-1 text-xs text-slate-500">
              Edit the name, then verify again. Case and surrounding whitespace
              are normalized. Edits here are a temporary tamper test, not
              registry updates.
            </p>
          </div>
          <Fingerprint className="h-5 w-5 text-slate-400" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="proof-owner" className="mb-2 block text-xs">
              Owner name
            </Label>
            <Input
              id="proof-owner"
              value={form.owner}
              onChange={(e) => {
                setForm((old) => ({ ...old, owner: e.target.value }));
              }}
              className="bg-white"
            />
          </div>
          <Button
            onClick={onVerify}
            className="self-end bg-slate-900 text-white hover:bg-slate-800"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify integrity
          </Button>
        </div>
      </div>
      {notice && (
        <p className="mt-4 text-center text-xs text-slate-500">{notice}</p>
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={onDone} variant="outline">
          Done
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  confidence,
  setForm,
  type = 'text',
}: {
  label: string;
  name: keyof FormData;
  value: string;
  confidence: number;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  type?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor={name} className="text-xs font-semibold text-slate-600">
          {label}
        </Label>
        <ConfidenceBadge value={confidence} />
      </div>
      <Input
        id={name}
        type={type}
        value={value}
        min={type === 'number' ? '0.01' : undefined}
        step={type === 'number' ? '.01' : undefined}
        onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
        className={`h-10 bg-white ${!value || confidence < 60 ? 'border-amber-300 focus-visible:border-amber-500 focus-visible:ring-amber-200' : ''}`}
      />
    </div>
  );
}
function ConfidenceBadge({
  value,
  large = false,
}: {
  value: number;
  large?: boolean;
}) {
  const tone =
    value >= 80
      ? 'bg-teal-100 text-teal-800'
      : value >= 60
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const label =
    value >= 80
      ? 'High'
      : value >= 60
        ? 'Review'
        : value > 0
          ? 'Low'
          : 'Manual';
  return (
    <span
      className={`shrink-0 rounded-full font-semibold ${tone} ${large ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[10px]'}`}
    >
      {large && value > 0 ? `${value}% · ` : ''}
      {label}
    </span>
  );
}
function SampleDocument() {
  return (
    <div className="w-full max-w-[370px] rotate-[-.6deg] rounded-sm bg-[#fffef8] p-7 font-serif text-slate-800 shadow-[0_12px_35px_rgba(15,23,42,.18)] ring-1 ring-slate-300">
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em]">
          Synthetic sample · not an official record
        </p>
        <p className="mt-2 text-lg font-bold">
          Record of Rights, Tenancy & Crops
        </p>
      </div>
      <div className="mt-5 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-xs">
        <b>Record No.</b>
        <span>RTC-2040-23</span>
        <b>Village</b>
        <span>Devanahalli</span>
        <b>Survey No.</b>
        <span>48/2B</span>
        <b>Owner</b>
        <span>Meera Krishnan</span>
        <b>Total extent</b>
        <span>1.84 acres</span>
        <b>Issue date</b>
        <span>18 January 2023</span>
      </div>
      <div className="mt-8 flex justify-between border-t border-slate-300 pt-4 text-[10px] text-slate-500">
        <span>Digitally scanned copy</span>
        <span>Revenue Department</span>
      </div>
    </div>
  );
}
function StepRail({ step }: { step: Step }) {
  const active =
    step === 'upload' || step === 'processing'
      ? 0
      : step === 'review'
        ? 1
        : step === 'approved'
          ? 2
          : 3;
  return (
    <div className="mx-auto mb-2 flex max-w-2xl items-center">
      {['Upload', 'Review', 'Validate', 'Verify'].map((label, index) => (
        <div key={label} className="contents">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index <= active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-400'}`}
            >
              {index < active ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={`text-[11px] font-semibold ${index <= active ? 'text-teal-800' : 'text-slate-400'}`}
            >
              {label}
            </span>
          </div>
          {index < 3 && (
            <span
              className={`mb-5 h-px flex-1 ${index < active ? 'bg-teal-600' : 'bg-slate-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
function StatusBadge({ status }: { status: Status }) {
  const classes = {
    Attested: 'bg-teal-500/10 text-teal-700 border-teal-600/20',
    Pending: 'bg-amber-500/10 text-amber-800 border-amber-600/20',
    Anchored: 'bg-violet-500/10 text-violet-700 border-violet-600/20',
    Validated: 'bg-sky-500/10 text-sky-700 border-sky-600/20',
    'Needs review': 'bg-amber-500/10 text-amber-800 border-amber-600/20',
  };
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2.5 py-1 font-medium ${classes[status]}`}
    >
      {(status === 'Attested' || status === 'Anchored') && (
        <CheckCircle2 className="mr-1 h-3 w-3" />
      )}
      {status}
    </Badge>
  );
}
function NavItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  count?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-auto shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition lg:w-full ${active ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {count && (
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
          {count}
        </span>
      )}
    </button>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'navy',
}: {
  icon: typeof FileSearch;
  label: string;
  value: string;
  detail: string;
  tone?: 'navy' | 'teal' | 'amber';
}) {
  const colors = {
    navy: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function stepLabel(step: Step) {
  return step === 'details'
    ? 'Full record information and proof status.'
    : step === 'upload'
      ? 'Upload a clean, typed record or use the built-in sample.'
      : step === 'processing'
        ? 'Extracting text with browser-based OCR.'
        : step === 'review'
          ? 'Compare the source and confirm every field.'
          : step === 'approved'
            ? 'Validation passed. Sign the approved fingerprint without gas.'
            : 'Recompute the fingerprint and recover the approving signer.';
}

function attestationMessage(recordId: string, fingerprint: string) {
  return `BhoomiSetu Record Attestation\nRecord ID: ${recordId}\nSHA-256: ${fingerprint}\nPurpose: Approve this validated land-record fingerprint.`;
}

function utf8ToHex(value: string) {
  return `0x${[...new TextEncoder().encode(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function scoreFields(form: FormData, overall: number): FieldConfidence {
  // No fabricated per-field percentages: extracted values always require review.
  const score = (value: string, _bonus = 0) => (value && overall > 0 ? 60 : 0);
  return {
    owner: score(form.owner, 4),
    survey: score(form.survey, 10),
    village: score(form.village, 5),
    area: score(form.area, 10),
    recordNo: score(form.recordNo, 9),
    issueDate: score(form.issueDate, 6),
  };
}

async function enhanceImage(file: File, enhance = true): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  const scale = Math.min(
    enhance ? 2 : 1,
    2400 / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('CANVAS_UNAVAILABLE');
  }
  context.filter = enhance ? 'grayscale(1) contrast(1.28)' : 'none';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  if (!enhance)
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.94),
    );
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < image.data.length; index += 4)
    histogram[image.data[index]]++;
  const total = canvas.width * canvas.height;
  let low = 0;
  let high = 255;
  let seen = 0;
  for (; low < 255; low++) {
    seen += histogram[low];
    if (seen >= total * 0.015) break;
  }
  seen = 0;
  for (; high > 0; high--) {
    seen += histogram[high];
    if (seen >= total * 0.015) break;
  }
  const range = Math.max(1, high - low);
  for (let index = 0; index < image.data.length; index += 4) {
    const normalized = Math.max(
      0,
      Math.min(255, ((image.data[index] - low) * 255) / range),
    );
    image.data[index] = normalized;
    image.data[index + 1] = normalized;
    image.data[index + 2] = normalized;
  }
  context.putImageData(image, 0, 0);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.94),
  );
}
