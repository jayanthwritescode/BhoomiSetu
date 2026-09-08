import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  hashRecord,
  normalizeParcel,
  parseOcr,
  validationErrors,
} from '../lib/records.ts';

const form = {
  owner: 'Ananya Rao',
  survey: '48/2B',
  village: 'Devanahalli',
  area: '1.84',
  recordNo: 'RTC-1948-22',
  issueDate: '2022-06-14',
};
const validate = (value) => validationErrors(value, '2026-09-09');
test('valid form passes explicit prototype checks', () =>
  assert.deepEqual(validate(form), []));
for (const key of Object.keys(form))
  test(`whitespace-only ${key} is rejected`, () =>
    assert.ok(validate({ ...form, [key]: '   ' }).length));
for (const area of [
  'Infinity',
  'NaN',
  '-1',
  '0',
  '1.841',
  '1e3',
  '9999999999',
  '1,84',
])
  test(`unsafe area ${area} is rejected`, () =>
    assert.ok(validate({ ...form, area }).length));
for (const issueDate of [
  '2023-02-29',
  '2024-04-31',
  '2027-01-01',
  '1799-01-01',
  '06/14/2022',
])
  test(`invalid issue date ${issueDate} is rejected`, () =>
    assert.ok(validate({ ...form, issueDate }).length));
test('leap day is accepted in leap years', () =>
  assert.deepEqual(validate({ ...form, issueDate: '2024-02-29' }), []));
test('survey permits a plain parcel number', () =>
  assert.deepEqual(validate({ ...form, survey: '48' }), []));
test('duplicate matching normalizes case and whitespace', () =>
  assert.equal(normalizeParcel(' 48 / 2b '), normalizeParcel('48/2B')));
test('duplicate matching normalizes Unicode width', () =>
  assert.equal(normalizeParcel('４８/２Ｂ'), normalizeParcel('48/2B')));
test('hash matches independently calculated legacy v1 payload', async () => {
  const payload = JSON.stringify({
    version: 1,
    owner: 'ananya rao',
    survey: '48/2B',
    village: 'devanahalli',
    area: '1.84',
    recordNo: 'RTC-1948-22',
    issueDate: '2022-06-14',
  });
  assert.equal(
    await hashRecord(form),
    createHash('sha256').update(payload).digest('hex'),
  );
});
test('legacy hash intentionally normalizes case and surrounding spaces', async () =>
  assert.equal(
    await hashRecord(form),
    await hashRecord({ ...form, owner: ' ANANYA RAO ', area: '1.840' }),
  ));
for (const [key, value] of Object.entries({
  owner: 'Ananya Rao X',
  survey: '48/2C',
  village: 'Hoskote',
  area: '1.85',
  recordNo: 'RTC-1948-23',
  issueDate: '2022-06-15',
}))
  test(`meaningful ${key} changes invalidate fingerprint`, async () =>
    assert.notEqual(
      await hashRecord(form),
      await hashRecord({ ...form, [key]: value }),
    ));
test('empty OCR does not invent data', () =>
  assert.ok(Object.values(parseOcr('')).every((value) => value === '')));
test('English labelled extraction', () => {
  const result = parseOcr(
    'Owner: Ananya Rao\nSurvey No: 48/2B\nVillage: Devanahalli\nExtent: 1.84 acres\nRecord: RTC-1948-22\nIssued: 14/06/2022',
  );
  assert.deepEqual(result, form);
});
test('ISO date is retained, not interpreted as day-first', () =>
  assert.equal(parseOcr('Issue date: 2022-06-14').issueDate, '2022-06-14'));
test('impossible OCR dates remain blank for review', () =>
  assert.equal(parseOcr('Issued: 31/02/2023').issueDate, ''));
test('ambiguous two-digit years are not silently guessed', () =>
  assert.equal(parseOcr('Issued: 14/06/22').issueDate, ''));
test('Kannada labels preserve Kannada text', () => {
  const result = parseOcr(
    'ಮಾಲೀಕರ ಹೆಸರು: ಅನನ್ಯ ರಾವ್\nಸರ್ವೆ ಸಂಖ್ಯೆ: 48/2B\nಗ್ರಾಮದ ಹೆಸರು: ದೇವನಹಳ್ಳಿ\nಒಟ್ಟು ವಿಸ್ತೀರ್ಣ: 1.84',
  );
  assert.equal(result.owner, 'ಅನನ್ಯ ರಾವ್');
  assert.equal(result.village, 'ದೇವನಹಳ್ಳಿ');
  assert.equal(result.survey, '48/2B');
  assert.equal(result.area, '1.84');
});
