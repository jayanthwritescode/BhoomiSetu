from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Flowable, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from pathlib import Path


ROOT = Path('/Users/jayanth/Desktop/IIC')
OUT = ROOT / 'output/pdf/BhoomiSetu_Project_Report.pdf'

NAVY = colors.HexColor('#071B2B')
TEAL = colors.HexColor('#0B766D')
TEAL_LIGHT = colors.HexColor('#DDF7F3')
VIOLET = colors.HexColor('#6D4AFF')
INK = colors.HexColor('#172033')
MUTED = colors.HexColor('#64748B')
LINE = colors.HexColor('#DCE4EA')
PAPER = colors.HexColor('#F5F8FA')
AMBER = colors.HexColor('#B45309')
RED = colors.HexColor('#B42318')
GREEN = colors.HexColor('#087A63')
WHITE = colors.white


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(page_count)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return
        self.saveState()
        self.setStrokeColor(LINE)
        self.line(18 * mm, 15 * mm, 192 * mm, 15 * mm)
        self.setFont('Helvetica', 8)
        self.setFillColor(MUTED)
        self.drawString(18 * mm, 9.5 * mm, 'BhoomiSetu - Prototype Project Report')
        self.drawRightString(192 * mm, 9.5 * mm, f'{self._pageNumber} / {page_count}')
        self.restoreState()


class SectionTag(Flowable):
    def __init__(self, text, width=42 * mm):
        Flowable.__init__(self)
        self.text = text.upper()
        self.width = width
        self.height = 7 * mm

    def draw(self):
        self.canv.setFillColor(TEAL_LIGHT)
        self.canv.roundRect(0, 0, self.width, self.height, 3.5 * mm, fill=1, stroke=0)
        self.canv.setFillColor(TEAL)
        self.canv.setFont('Helvetica-Bold', 7.5)
        self.canv.drawCentredString(self.width / 2, 2.35 * mm, self.text)


def page_bg(canv, doc):
    canv.saveState()
    if doc.page == 1:
        canv.setFillColor(NAVY)
        canv.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canv.setFillColor(colors.HexColor('#0E3349'))
        canv.circle(178 * mm, 262 * mm, 54 * mm, fill=1, stroke=0)
        canv.setFillColor(colors.HexColor('#0A293C'))
        canv.circle(22 * mm, 34 * mm, 44 * mm, fill=1, stroke=0)
        canv.setStrokeColor(colors.HexColor('#2DD4BF'))
        canv.setLineWidth(1)
        for r in (14, 22, 30):
            canv.circle(171 * mm, 263 * mm, r * mm, fill=0, stroke=1)
    else:
        canv.setFillColor(WHITE)
        canv.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canv.setFillColor(TEAL)
        canv.rect(0, A4[1] - 7 * mm, A4[0], 7 * mm, fill=1, stroke=0)
    canv.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverKicker', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=colors.HexColor('#5EEAD4'), spaceAfter=8, uppercase=True))
styles.add(ParagraphStyle(name='CoverTitle', fontName='Helvetica-Bold', fontSize=29, leading=33, textColor=WHITE, spaceAfter=14))
styles.add(ParagraphStyle(name='CoverSub', fontName='Helvetica', fontSize=13, leading=19, textColor=colors.HexColor('#C7D7E2'), spaceAfter=20))
styles.add(ParagraphStyle(name='CoverMeta', fontName='Helvetica', fontSize=9.5, leading=15, textColor=colors.HexColor('#AFC3D2')))
styles.add(ParagraphStyle(name='H1x', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name='H2x', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=NAVY, spaceBefore=11, spaceAfter=6))
styles.add(ParagraphStyle(name='H3x', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=TEAL, spaceBefore=7, spaceAfter=4))
styles.add(ParagraphStyle(name='Bodyx', fontName='Helvetica', fontSize=9.2, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name='Smallx', fontName='Helvetica', fontSize=7.8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name='Callout', fontName='Helvetica-Bold', fontSize=11, leading=16, textColor=NAVY, alignment=TA_LEFT))
styles.add(ParagraphStyle(name='TableHead', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=WHITE))
styles.add(ParagraphStyle(name='TableCell', fontName='Helvetica', fontSize=7.8, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name='TableCellBold', fontName='Helvetica-Bold', fontSize=7.8, leading=10.5, textColor=NAVY))
styles.add(ParagraphStyle(name='Caption', fontName='Helvetica-Oblique', fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_CENTER, spaceBefore=4))
styles.add(ParagraphStyle(name='Mono', fontName='Courier', fontSize=7.5, leading=10, textColor=NAVY))


def p(text, style='Bodyx'):
    return Paragraph(text, styles[style])


def bullet_list(items, level=0):
    return ListFlowable(
        [ListItem(p(item), leftIndent=3 * mm) for item in items],
        bulletType='bullet', start='circle', leftIndent=6 * mm, bulletFontName='Helvetica',
        bulletFontSize=5.5, bulletColor=TEAL, spaceAfter=5
    )


def section(title, tag=None):
    parts = []
    if tag:
        parts += [SectionTag(tag), Spacer(1, 3 * mm)]
    parts += [p(title, 'H1x'), HRFlowable(width='100%', thickness=1, color=LINE, spaceAfter=7)]
    return parts


def status_chip(label, color):
    return Table([[p(label, 'TableCellBold')]], colWidths=[29 * mm], rowHeights=[8 * mm], style=TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color), ('BOX', (0, 0), (-1, -1), 0.5, color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 3 * mm),
    ]))


def info_box(title, body, color=TEAL_LIGHT):
    data = [[p(title, 'Callout')], [p(body)]]
    return Table(data, colWidths=[174 * mm], style=TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color), ('BOX', (0, 0), (-1, -1), 0.7, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), 5 * mm), ('RIGHTPADDING', (0, 0), (-1, -1), 5 * mm),
        ('TOPPADDING', (0, 0), (-1, 0), 4 * mm), ('BOTTOMPADDING', (0, 1), (-1, -1), 4 * mm),
    ]))


def styled_table(headers, rows, widths):
    data = [[p(h, 'TableHead') for h in headers]] + [[p(str(c), 'TableCell') for c in row] for row in rows]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('GRID', (0, 0), (-1, -1), 0.45, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, PAPER]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3 * mm), ('RIGHTPADDING', (0, 0), (-1, -1), 3 * mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2.4 * mm), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.4 * mm),
    ]))
    return table


def flow_diagram():
    labels = ['Upload', 'OCR', 'Human review', 'SHA-256', 'Wallet / Polygon', 'Verify']
    cells = []
    for i, label in enumerate(labels):
        cells.append(p(f'<b>{i + 1}</b><br/>{label}', 'TableCell'))
        if i < len(labels) - 1:
            cells.append(p('>', 'TableCellBold'))
    widths = []
    for i in range(len(cells)):
        widths.append(26 * mm if i % 2 == 0 else 3.6 * mm)
    t = Table([cells], colWidths=widths, rowHeights=[18 * mm])
    style = [('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
             ('LEFTPADDING', (0, 0), (-1, -1), 1.2 * mm), ('RIGHTPADDING', (0, 0), (-1, -1), 1.2 * mm)]
    for i in range(1, len(cells), 2):
        style += [('LEFTPADDING', (i, 0), (i, 0), 0), ('RIGHTPADDING', (i, 0), (i, 0), 0)]
    for i in range(0, len(cells), 2):
        style += [('BACKGROUND', (i, 0), (i, 0), TEAL_LIGHT), ('BOX', (i, 0), (i, 0), 0.7, colors.HexColor('#9CDDD5'))]
    t.setStyle(TableStyle(style))
    return t


doc = BaseDocTemplate(
    str(OUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
    topMargin=18 * mm, bottomMargin=20 * mm, title='BhoomiSetu - Intelligent Land Record Digitization and Validation System',
    author='BhoomiSetu Project Team', subject='Hackathon prototype project report'
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
doc.addPageTemplates(PageTemplate(id='all', frames=frame, onPage=page_bg))

story = []

# Cover
story += [Spacer(1, 28 * mm), p('HACKATHON PROTOTYPE REPORT', 'CoverKicker'),
          p('BhoomiSetu', 'CoverTitle'),
          p('Intelligent Land Record Digitization<br/>and Validation System', 'CoverTitle'),
          p('Turning legacy land records into searchable, validated, and tamper-evident digital records.', 'CoverSub'),
          Spacer(1, 14 * mm)]
cover_meta = Table([
    [p('<b>Report type</b>', 'CoverMeta'), p('Technical project report', 'CoverMeta')],
    [p('<b>Build stage</b>', 'CoverMeta'), p('Functional hackathon prototype', 'CoverMeta')],
    [p('<b>Report date</b>', 'CoverMeta'), p('09 September 2026', 'CoverMeta')],
    [p('<b>Live prototype</b>', 'CoverMeta'), p('<link href="https://bhoomisetu-land-records.techsawyer250.chatgpt.site/" color="#5EEAD4">bhoomisetu-land-records.techsawyer250.chatgpt.site</link>', 'CoverMeta')],
], colWidths=[35 * mm, 122 * mm], style=TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0B293B')), ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor('#31556A')),
    ('INNERGRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#31556A')), ('LEFTPADDING', (0, 0), (-1, -1), 4 * mm),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4 * mm), ('TOPPADDING', (0, 0), (-1, -1), 3.2 * mm), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.2 * mm),
]))
story += [cover_meta, Spacer(1, 31 * mm), p('Private prototype publication - intended for demonstration and evaluation, not production land administration.', 'CoverMeta'), PageBreak()]

# Executive summary
story += section('Executive summary', '01 / Overview')
story += [p('BhoomiSetu is a browser-based land-record digitization and verification prototype designed for a 12-hour hackathon build. It demonstrates a complete, judge-ready path from a scanned record to structured fields, human validation, a deterministic cryptographic fingerprint, and two proof options: gasless wallet attestation or Polygon Amoy anchoring.'),
          info_box('Core outcome', 'The prototype proves that legacy records can be converted into reviewable digital records and that any later change can be detected by recomputing the approved fingerprint. The design keeps names, documents, and parcel details off-chain.'),
          Spacer(1, 5 * mm), p('Project objectives', 'H2x'),
          bullet_list([
              '<b>Digitize:</b> accept legacy record scans and extract structured information using OCR.',
              '<b>Validate:</b> require human confirmation and run completeness, format, area, date, and duplicate-parcel checks.',
              '<b>Search:</b> provide a usable registry view across record ID, owner, survey number, village, and record number.',
              '<b>Protect integrity:</b> canonicalize each approved record and calculate a SHA-256 fingerprint.',
              '<b>Verify trust:</b> support wallet-signed attestations and optional Polygon Amoy transaction anchoring.'
          ]),
          p('Current prototype status', 'H2x')]
status_rows = [
    ['Interface and workflow', 'Implemented', 'End-to-end modal workflow and searchable registry.'],
    ['OCR', 'Implemented', 'Browser-side English and English + Kannada recognition with preprocessing and confidence signals.'],
    ['Validation', 'Implemented', 'Human review plus duplicate-parcel and required-field checks.'],
    ['Gasless wallet proof', 'Implemented', 'MetaMask personal signature and signer recovery.'],
    ['Polygon Amoy anchor', 'Implemented with dependency', 'Requires MetaMask and test POL for network gas.'],
    ['MongoDB persistence', 'Not yet integrated', 'Current records and new proofs are held in browser memory for the session.'],
    ['Merkle batch anchoring', 'Designed, not built', 'Recommended production evolution to amortize gas across many records.'],
]
story += [styled_table(['Capability', 'Status', 'Notes'], status_rows, [43 * mm, 34 * mm, 97 * mm]), PageBreak()]

# Problem and scope
story += section('Problem definition and scope', '02 / Context')
story += [p('Legacy land records are often stored as scans or paper documents. They are difficult to search, prone to transcription errors, and hard to verify after digitization. A trustworthy system must preserve the original evidence, support human review, and make unauthorized changes detectable without exposing personal data on a public ledger.'),
          p('In scope for the prototype', 'H2x'),
          bullet_list([
              'PNG and JPEG upload up to 12 MB.',
              'Image normalization using grayscale, contrast enhancement, resizing, and percentile-based tonal stretching.',
              'Tesseract.js OCR with English and optional Kannada language selection.',
              'Structured extraction for owner, survey number, village, area, record number, and issue date.',
              'Field-level confidence cues and editable human review.',
              'Duplicate parcel warning using village and survey number.',
              'Deterministic SHA-256 fingerprint generation.',
              'Gasless wallet signature and optional Polygon Amoy anchoring.',
              'Integrity verification by recomputation and proof comparison.'
          ]),
          p('Explicitly outside the current build', 'H2x'),
          bullet_list([
              'Production-grade identity, authorization roles, and audit administration.',
              'PDF ingestion, handwriting recognition, layout-aware OCR, and large batch uploads.',
              'Authoritative cadastral or government-registry integration.',
              'Durable MongoDB persistence, file storage, backups, and migration tooling.',
              'Production key custody, relayer service, paymaster, or automatic Merkle batch anchoring.',
              'Legal certification or replacement of official land-title processes.'
          ]),
          info_box('Scope principle', 'The prototype favors a reliable, explainable demonstration over an ambitious but incomplete platform. It is a proof of workflow and integrity architecture, not a production land registry.', colors.HexColor('#FFF3D6')), PageBreak()]

# Architecture
story += section('Solution architecture', '03 / Design')
story += [p('The current application is a client-heavy web prototype. OCR, normalization, hashing, wallet requests, and most validation run in the browser. This protects uploaded documents from unnecessary transmission and keeps the demonstration deployable without a specialized processing backend.'),
          Spacer(1, 4 * mm), flow_diagram(), p('Figure 1. Current end-to-end record workflow.', 'Caption'),
          p('Logical components', 'H2x')]
arch_rows = [
    ['Presentation layer', 'Vinext / React interface', 'Registry, upload, review, proof selection, and verification views.'],
    ['OCR engine', 'Tesseract.js', 'Runs recognition locally in the browser; reports progress and overall confidence.'],
    ['Image preparation', 'Canvas API', 'Resizes large scans, applies grayscale and contrast, and normalizes tonal range.'],
    ['Validation engine', 'Client-side rules', 'Required fields, positive area, date/identifier handling, and duplicate parcel warning.'],
    ['Integrity engine', 'Web Crypto SHA-256', 'Produces a stable fingerprint from canonical record fields.'],
    ['Wallet proof', 'MetaMask personal_sign', 'Signs the record ID and fingerprint without broadcasting a transaction.'],
    ['Blockchain proof', 'Polygon Amoy RPC', 'Stores the fingerprint in transaction input and reads it back after confirmation.'],
    ['Persistence target', 'MongoDB', 'Planned store for records, OCR metadata, signatures, proof state, and audit history.'],
]
story += [styled_table(['Layer', 'Technology', 'Responsibility'], arch_rows, [36 * mm, 42 * mm, 96 * mm]),
          p('Deployment', 'H2x'),
          p('The prototype is packaged as a Vinext application and privately published using OpenAI Sites. The current implementation contains no production database secret, private blockchain key, or server-side custody component.'), PageBreak()]

# OCR pipeline
story += section('OCR and validation pipeline', '04 / Intelligence')
story += [p('OCR is intentionally treated as an assistive extraction step rather than an authority. The application exposes confidence and raw OCR output, then requires a reviewer to confirm every field before approval.'),
          p('OCR processing sequence', 'H2x')]
ocr_rows = [
    ['1. Input gate', 'Accept PNG/JPEG only; reject files over 12 MB.'],
    ['2. Preprocess', 'Respect image orientation, resize toward a 2400 px working width, convert to grayscale, and increase contrast.'],
    ['3. Normalize', 'Use a pixel histogram to clip extreme dark/light percentiles and stretch usable tonal range.'],
    ['4. Recognize', 'Run Tesseract.js using English or English + Kannada language data.'],
    ['5. Retry', 'When enhanced-image confidence is below 68%, compare against recognition on the original image.'],
    ['6. Parse', 'Apply label-aware and regular-expression extraction to populate six target fields.'],
    ['7. Score', 'Derive field confidence from overall OCR confidence and whether a usable field was extracted.'],
    ['8. Review', 'Display source and fields side by side; allow corrections before approval.'],
]
story += [styled_table(['Stage', 'Behavior'], ocr_rows, [37 * mm, 137 * mm]),
          p('Validation rules demonstrated', 'H2x'),
          bullet_list([
              'All six record fields must be populated.',
              'Area must parse to a number greater than zero.',
              'Dates and record identifiers are normalized during parsing.',
              'A matching survey number and village triggers a possible parcel-conflict warning.',
              'Approval is disabled while required data is missing or a duplicate conflict remains unresolved.'
          ]),
          info_box('Reliability boundary', 'Confidence percentages are review aids, not legal certainty. Handwriting, damaged scans, mixed layouts, and administrative abbreviations require additional models, training data, or manual entry.', colors.HexColor('#FFF3D6')), PageBreak()]

# Trust and blockchain
story += section('Trust, wallet, and blockchain model', '05 / Integrity')
story += [p('BhoomiSetu uses data minimization: only a cryptographic fingerprint is signed or anchored. The original scan and personal record fields remain off-chain. This avoids public exposure, reduces transaction size, and permits controlled corrections while preserving a verifiable history.'),
          p('Deterministic fingerprint', 'H2x'),
          p('Before hashing, values are normalized: names and villages are trimmed and lowercased, survey and record numbers are uppercased, area is fixed to two decimals, and the date is stored in ISO form. The canonical JSON payload is then hashed with SHA-256.'),
          p('Gasless wallet attestation', 'H2x'),
          bullet_list([
              'MetaMask signs a human-readable message containing the record ID, SHA-256 fingerprint, and approval purpose.',
              'No chain switch, POL balance, or transaction fee is required.',
              'Verification recovers the signer address from the message and signature and checks that the record fingerprint is unchanged.',
              'The signature is not stored by MetaMask and is not discoverable on-chain; BhoomiSetu must persist it.'
          ]),
          p('Polygon Amoy anchoring', 'H2x'),
          bullet_list([
              'The wallet switches to Polygon Amoy, chain ID 80002.',
              'A zero-value self-transaction carries the fingerprint in its input data.',
              'The application waits for a successful receipt, stores the transaction hash, and reads the transaction input back during verification.',
              'This path is genuinely on-chain but cannot operate from an unfunded account because every public blockchain transaction consumes gas.'
          ]),
          info_box('Important distinction', 'Wallet-attested means cryptographically approved by a wallet. Polygon-anchored means the fingerprint was included in a confirmed public-chain transaction. The interface labels these states separately.', colors.HexColor('#ECE8FF')), PageBreak()]

# Data model and Mongo
story += section('Persistence and proposed MongoDB model', '06 / Data')
story += [p('The deployed prototype currently uses in-memory React state and seeded demonstration records. A page refresh discards newly created records and signatures. MongoDB integration is therefore the highest-priority step before multi-session testing or any operational pilot.'),
          p('Recommended record document', 'H2x')]
mongo_rows = [
    ['_id / recordId', 'Stable internal and human-readable identifier.'],
    ['source', 'Object storage key, MIME type, checksum, and upload metadata; do not store large scans directly in the record document.'],
    ['fields', 'Owner, survey, village, area, record number, and issue date.'],
    ['ocr', 'Language, raw text reference, overall confidence, per-field confidence, preprocessing version, and timestamp.'],
    ['validation', 'Reviewer, rule results, conflicts, approval state, and approved timestamp.'],
    ['integrity', 'Canonicalization version and approved SHA-256 fingerprint.'],
    ['walletProof', 'Signed message, signature, signer address, signing scheme, and signed timestamp.'],
    ['chainProof', 'Network, chain ID, transaction hash, block number, anchored fingerprint, and confirmation state.'],
    ['history', 'Append-only version references for corrections and superseded approvals.'],
]
story += [styled_table(['Field group', 'Contents'], mongo_rows, [40 * mm, 134 * mm]),
          p('Minimum indexes', 'H2x'),
          bullet_list([
              'Unique index on recordId.',
              'Compound index on village and survey number for conflict detection.',
              'Search indexes for owner, record number, and normalized parcel identifiers.',
              'Index on integrity.fingerprint for proof lookup and duplicate detection.',
              'Indexes on validation.state and chainProof.confirmationState for work queues.'
          ]),
          p('Security controls required', 'H2x'),
          bullet_list([
              'Keep database credentials server-side; never expose MongoDB credentials in browser JavaScript.',
              'Use role-based access, encryption in transit, encrypted backups, and a restricted network allowlist.',
              'Store original documents in controlled object storage and retain immutable checksums.',
              'Record every correction as a new version instead of silently overwriting an approved snapshot.'
          ]), PageBreak()]

# Merkle evolution
story += section('Recommended Merkle batch evolution', '07 / Scale')
story += [p('For production, individual fingerprints should be grouped into a Merkle tree and only the Merkle root anchored on Polygon. Each record retains a compact inclusion proof. This preserves public verifiability while spreading one transaction fee across hundreds or thousands of records.'),
          styled_table(['Step', 'Production behavior', 'User experience'], [
              ['1', 'Reviewer approves and signs the record fingerprint.', 'Immediate confirmation.'],
              ['2', 'Backend stores the signed record and places its fingerprint in an anchor queue.', 'Status: Wallet attested - queued.'],
              ['3', 'Scheduled worker creates a deterministic Merkle tree from queued fingerprints.', 'No user action.'],
              ['4', 'A controlled relayer submits one root to an anchoring contract.', 'No user-held gas required.'],
              ['5', 'Backend saves batch ID, root, transaction, leaf position, and sibling path.', 'Status: Blockchain anchored.'],
              ['6', 'Verifier recomputes the leaf and Merkle path, then compares the root with Polygon.', 'One-click proof result.'],
          ], [12 * mm, 96 * mm, 66 * mm]),
          Spacer(1, 5 * mm),
          info_box('Why this is viable', 'Merkle batching does not remove network fees; it amortizes them. A sponsor or government operator funds one transaction per batch while end users experience a gasless workflow.'),
          p('Recommended contract surface', 'H2x'),
          p('<font name="Courier">anchorRoot(bytes32 root, uint256 batchId)</font> should emit an event containing the root, batch ID, submitter, and block timestamp. Full documents, names, and parcel metadata should never be contract storage.'),
          p('Operational safeguards', 'H2x'),
          styled_table(['Control', 'Purpose'], [
              ['Deterministic ordering', 'Create each batch from an immutable ordered list and retain the algorithm version.'],
              ['Duplicate rejection', 'Prevent the same fingerprint from appearing twice within one batch.'],
              ['Controlled submission', 'Use an allowlisted relayer and multisignature administration.'],
              ['Stable retries', 'Retry failed submission without changing the original batch composition.'],
              ['Portable proof', 'Export inclusion proofs so verification is not dependent on the application UI.'],
          ], [42 * mm, 132 * mm]), PageBreak()]

# Demo and tests
story += section('Demonstration and verification plan', '08 / Demo')
story += [p('Recommended three-minute demonstration', 'H2x')]
demo_rows = [
    ['0:00-0:25', 'Problem', 'Show an unstructured legacy record and explain why search and trust are difficult.'],
    ['0:25-1:05', 'Digitize', 'Load the sample or upload a scan; highlight OCR progress, extracted fields, and confidence.'],
    ['1:05-1:35', 'Validate', 'Correct one field and show rule checks plus duplicate-parcel detection.'],
    ['1:35-2:10', 'Protect', 'Approve the record, generate the deterministic fingerprint, and sign the gasless wallet attestation.'],
    ['2:10-2:40', 'Prove', 'Verify the signature, change one character in the owner field, and show integrity failure.'],
    ['2:40-3:00', 'Scale story', 'Explain optional Polygon anchoring today and Merkle batch anchoring for production.'],
]
story += [styled_table(['Time', 'Moment', 'Action'], demo_rows, [25 * mm, 28 * mm, 121 * mm]),
          p('Current verification evidence', 'H2x'),
          bullet_list([
              'Production build completes successfully with Vinext.',
              'OCR reports progress and includes a low-confidence fallback pass.',
              'Approved record hashes are generated through the browser Web Crypto API.',
              'Wallet signatures are recoverable through the injected wallet provider.',
              'Polygon receipts are checked for success and transaction input can be read back from Amoy.',
              'Tamper testing is exposed directly in the proof view by editing the owner field and recomputing the fingerprint.'
          ]),
          p('Tests still required before pilot use', 'H2x'),
          bullet_list([
              'A representative corpus across scan quality, forms, languages, and administrative eras.',
              'Measured field-level precision, recall, correction rate, and reviewer time.',
              'API, persistence, authorization, concurrency, and audit-history tests.',
              'Threat modeling for replay, signature substitution, database tampering, compromised relayers, and document replacement.',
              'Accessibility, mobile layout, browser compatibility, and wallet-provider interoperability testing.'
          ]), PageBreak()]

# Risks and roadmap
story += section('Risks, limitations, and roadmap', '09 / Delivery')
risks = [
    ['OCR variability', 'High', 'Scans and layouts may differ sharply from the demonstration sample.', 'Build a labeled corpus; add layout detection and document-type templates.'],
    ['No durable persistence', 'Critical', 'New records disappear on refresh.', 'Implement server-side APIs, MongoDB, and controlled document storage first.'],
    ['Wallet proof loss', 'High', 'Gasless signatures are unrecoverable if the app does not persist them.', 'Persist full proof payload immediately and support proof export.'],
    ['Faucet / gas dependency', 'High', 'Polygon test anchoring can fail for unfunded wallets.', 'Use a funded relayer and Merkle batches; retain gasless signing for users.'],
    ['Legal authority', 'Critical', 'Cryptographic integrity does not establish legal title or correct source data.', 'Integrate authorized registries, reviewer identity, and jurisdictional process controls.'],
    ['Privacy', 'High', 'Land records contain sensitive personal information.', 'Minimize collection, enforce access policy, encrypt storage, and keep PII off-chain.'],
]
story += [styled_table(['Risk', 'Severity', 'Impact', 'Mitigation'], risks, [29 * mm, 19 * mm, 57 * mm, 69 * mm]),
          p('Phased roadmap', 'H2x')]
roadmap = [
    ['Phase 1 - Durable prototype', 'MongoDB API, object storage, proof persistence, record retrieval, and server-side validation.'],
    ['Phase 2 - Trust hardening', 'EIP-712 typed signatures, replay protection, reviewer roles, immutable version history, and proof export.'],
    ['Phase 3 - Batch anchoring', 'Merkle tree worker, anchoring contract, funded relayer, inclusion proof API, and automatic confirmation tracking.'],
    ['Phase 4 - OCR evaluation', 'Document templates, dataset benchmarks, handwriting strategy, multilingual tuning, and correction analytics.'],
    ['Phase 5 - Pilot readiness', 'Security review, disaster recovery, accessibility testing, monitoring, legal workflow mapping, and controlled pilot.'],
]
story += [styled_table(['Phase', 'Deliverables'], roadmap, [46 * mm, 128 * mm]),
          Spacer(1, 5 * mm), info_box('Immediate next decision', 'Prioritize MongoDB persistence before adding more blockchain complexity. Without durable storage, neither wallet signatures nor Merkle inclusion proofs can be retrieved after the browser session ends.', colors.HexColor('#FFF3D6')), PageBreak()]

# Conclusion
story += section('Conclusion', '10 / Summary')
story += [p('BhoomiSetu successfully demonstrates the essential hackathon story: extract a legacy record, make uncertainty visible, require a human decision, fingerprint the approved snapshot, and detect later changes. The result is coherent, explainable, and usable as a foundation for a more rigorous land-record workflow.'),
          p('The most important architectural conclusion is that blockchain should protect integrity, not store land records. Gasless wallet attestation provides immediate authorization; Polygon anchoring provides public timestamped evidence; and a future Merkle batching layer can combine the two into a seamless and economical production experience.'),
          Spacer(1, 4 * mm),
          info_box('Final assessment', 'The prototype is ready for hackathon demonstration. It is not yet ready for real land administration because durable persistence, authoritative identity, representative OCR evaluation, security controls, and legal-process integration remain unfinished.'),
          p('Technology summary', 'H2x'),
          styled_table(['Area', 'Current selection'], [
              ['Frontend', 'React 19 with Vinext and Tailwind CSS'],
              ['OCR', 'Tesseract.js 6 with Canvas preprocessing'],
              ['Hashing', 'SHA-256 through Web Crypto'],
              ['Wallet proof', 'MetaMask personal signing and signer recovery'],
              ['Blockchain', 'Polygon Amoy, chain ID 80002'],
              ['Database target', 'MongoDB - planned, not integrated in the current prototype'],
              ['Hosting', 'Private OpenAI Sites deployment'],
          ], [45 * mm, 129 * mm]),
          p('References', 'H2x'),
          p('Polygon account abstraction: <link href="https://docs.polygon.technology/pos/concepts/transactions/eip-4337" color="#0B766D">docs.polygon.technology/pos/concepts/transactions/eip-4337</link>', 'Smallx'),
          p('Polygon meta-transactions: <link href="https://docs.polygon.technology/pos/concepts/transactions/meta-transactions" color="#0B766D">docs.polygon.technology/pos/concepts/transactions/meta-transactions</link>', 'Smallx'),
          p('Tesseract.js: <link href="https://github.com/naptha/tesseract.js" color="#0B766D">github.com/naptha/tesseract.js</link>', 'Smallx'),
          Spacer(1, 12 * mm),
          HRFlowable(width='100%', thickness=1, color=LINE, spaceBefore=4, spaceAfter=8),
          p('Prepared from the implemented BhoomiSetu prototype source and deployment state as of 09 September 2026.', 'Smallx')]

doc.build(story, canvasmaker=NumberedCanvas)
print(OUT)
