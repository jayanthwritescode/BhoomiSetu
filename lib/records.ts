export type FormData = {
  owner: string;
  survey: string;
  village: string;
  area: string;
  recordNo: string;
  issueDate: string;
};

export function normalizeParcel(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function validationErrors(
  form: FormData,
  today = new Date().toISOString().slice(0, 10),
): string[] {
  const errors: string[] = [];
  if (Object.values(form).some((value) => !value.trim()))
    errors.push('Complete all six fields; whitespace alone is not valid.');
  if (
    !Number.isFinite(Number(form.area)) ||
    Number(form.area) <= 0 ||
    !/^\d{1,9}(?:\.\d{1,2})?$/.test(form.area.trim())
  )
    errors.push(
      'Area must be positive acres with at most two decimal places (demo precision).',
    );
  if (!/^\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)*$/.test(form.survey.trim()))
    errors.push('Use a survey identifier such as 48, 48/2B or 112/7.');
  if (!/^[A-Za-z0-9]+(?:[/-][A-Za-z0-9]+)*$/.test(form.recordNo.trim()))
    errors.push(
      'Record number may contain letters, numbers, slashes and hyphens.',
    );
  const date = new Date(form.issueDate + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.issueDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== form.issueDate ||
    form.issueDate > today ||
    form.issueDate < '1800-01-01'
  )
    errors.push('Enter a real issue date between 1800 and today.');
  return errors;
}

export function parseOcr(text: string): FormData {
  const sourceLines = text
    .split(/\r?\n/)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const line = text.replace(/[|]/g, 'I').replace(/\s+/g, ' ').trim();
  const capture = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return '';
  };
  const labelled = (labels: string[]) => {
    for (const source of sourceLines) {
      const lower = source.toLocaleLowerCase();
      for (const label of labels) {
        const index = lower.indexOf(label.toLocaleLowerCase());
        if (index >= 0) {
          const value = source
            .slice(index + label.length)
            .replace(/^[\s:.,-]+/, '')
            .trim();
          if (value.length > 1) return value;
        }
      }
    }
    return '';
  };
  const isoDate = capture([/\b(\d{4}-\d{2}-\d{2})\b/]);
  const rawDate = capture([
    /(?:issue\s+date|issued|date)\s*[:.-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/,
  ]);
  const parts = rawDate.split(/[./-]/);
  const candidateDate =
    isoDate ||
    (parts.length === 3 && parts[2].length === 4
      ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      : '');
  const parsedDate = new Date(candidateDate + 'T00:00:00Z');
  const issueDate =
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === candidateDate
      ? candidateDate
      : '';
  const labelledOwner = labelled(['ಮಾಲೀಕರ ಹೆಸರು', 'ಖಾತೆದಾರರ ಹೆಸರು', 'ಮಾಲೀಕ']);
  const labelledSurvey = labelled(['ಸರ್ವೆ ಸಂಖ್ಯೆ', 'ಸರ್ವೆ ನಂ']);
  const labelledVillage = labelled(['ಗ್ರಾಮದ ಹೆಸರು', 'ಗ್ರಾಮ']);
  const labelledArea = labelled(['ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ', 'ವಿಸ್ತೀರ್ಣ']);
  const labelledRecord = labelled(['ದಾಖಲೆ ಸಂಖ್ಯೆ', 'ಆರ್ ಟಿ ಸಿ ಸಂಖ್ಯೆ']);
  return {
    owner:
      labelledOwner ||
      capture([
        /(?:owner|holder|pattadar|khatedar|occupant|name)\s*[:.-]?\s*([A-Za-z][A-Za-z .]{3,40}?)(?=\s+(?:survey|village|extent|area|record|rtc|date|issued)|$)/i,
      ]),
    survey: (
      labelledSurvey.match(/[\dO]+\s*[/-]\s*[\dA-Za-z]+/)?.[0] ||
      capture([
        /(?:survey|sy\.?\s*no|plot|parcel)\s*(?:no\.?)?\s*[:.-]?\s*([\dO]+\s*[/-]\s*[\dA-Za-z]+)/i,
      ])
    )
      .replaceAll(' ', '')
      .replace(/^O/, '0'),
    village:
      labelledVillage ||
      capture([
        /(?:village|grama|locality)\s*[:.-]?\s*([A-Za-z ]{3,30}?)(?=\s+(?:survey|owner|holder|extent|area|record|rtc|date|issued)|$)/i,
      ]),
    area: (
      labelledArea.match(/[\dO]+(?:[.,][\dO]+)?/)?.[0] ||
      capture([
        /(?:total\s+extent|extent|area)\s*[:.-]?\s*([\dO]+(?:[.,][\dO]+)?)/i,
      ])
    )
      .replace(',', '.')
      .replaceAll('O', '0'),
    recordNo: (
      labelledRecord.match(/[A-Za-z0-9\s/-]{5,24}/)?.[0] ||
      capture([/\b((?:RTC|MR|LR|ROR)[-\s]\d{3,6}[-/]\d{2,4})\b/i])
    )
      .replaceAll(' ', '-')
      .toUpperCase(),
    issueDate,
  };
}

export async function hashRecord(form: Partial<FormData>) {
  const canonical = JSON.stringify({
    version: 1,
    owner: form.owner?.trim().toLowerCase(),
    survey: form.survey?.trim().toUpperCase(),
    village: form.village?.trim().toLowerCase(),
    area: Number(form.area).toFixed(2),
    recordNo: form.recordNo?.trim().toUpperCase(),
    issueDate: form.issueDate,
  });
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
