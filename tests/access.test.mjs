import test from 'node:test';
import assert from 'node:assert/strict';
import {
  brokerLookup,
  canManage,
  checkOwnership,
  matchingParcels,
} from '../lib/access.ts';

const details = {
  owner: 'Vikram Gowda',
  survey: '112/7',
  village: 'Hoskote',
  area: '2.10',
  recordNo: 'RTC-7731-19',
  issueDate: '2019-11-02',
};
const record = {
  ...details,
  status: 'Validated',
  id: 'LR-2026-0183',
  hash: 'private-hash',
  txHash: 'private-reference',
  signer: 'private-wallet',
};

test('only the official demo profile has management tools', () => {
  assert.equal(canManage('official'), true);
  assert.equal(canManage('public'), false);
  assert.equal(canManage('broker'), false);
  assert.equal(canManage('unknown'), false);
});
test('public exact match returns only a verdict', () =>
  assert.equal(checkOwnership([record], details), 'match'));
for (const field of Object.keys(details))
  test(`public lookup requires ${field}`, () =>
    assert.equal(
      checkOwnership([record], { ...details, [field]: '' }),
      'no-match',
    ));
for (const field of Object.keys(details))
  test(`incorrect ${field} does not reveal a partial match`, () =>
    assert.equal(
      checkOwnership([record], {
        ...details,
        [field]: field === 'area' ? '3.00' : 'wrong',
      }),
      'no-match',
    ));
test('case and outer whitespace do not prevent an otherwise exact match', () =>
  assert.equal(
    checkOwnership([record], { ...details, owner: ' VIKRAM GOWDA ' }),
    'match',
  ));
test('ambiguous duplicate parcel never returns a confirmed match', () =>
  assert.equal(
    checkOwnership([record, { ...record, owner: 'Another claimant' }], details),
    'inconclusive',
  ));
test('unreviewed record is inconclusive', () =>
  assert.equal(
    checkOwnership([{ ...record, status: 'Needs review' }], details),
    'inconclusive',
  ));
test('broker receives owner and parcel summary, not identifiers or proof payload', () => {
  assert.deepEqual(brokerLookup([record], '112/7', 'Hoskote'), [
    {
      owner: details.owner,
      survey: details.survey,
      village: details.village,
      area: details.area,
      status: 'Validated',
    },
  ]);
});
test('broker lookup requires both parcel and locality', () => {
  assert.deepEqual(brokerLookup([record], '', 'Hoskote'), []);
  assert.deepEqual(brokerLookup([record], '112/7', ''), []);
});
test('broker lookup is not a partial search', () =>
  assert.deepEqual(brokerLookup([record], '112', 'Hos'), []));
test('same parcel number in another locality is not returned', () =>
  assert.deepEqual(matchingParcels([record], '112/7', 'Other village'), []));
test('all conflicting parcel claims are retained for the broker warning', () =>
  assert.equal(
    brokerLookup(
      [record, { ...record, owner: 'Other claimant' }],
      '112/7',
      'Hoskote',
    ).length,
    2,
  ));
