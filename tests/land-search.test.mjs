import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLand } from '../lib/access.ts';

const a = {
  owner: 'Aarav Sharma',
  survey: '215/3',
  village: 'Jaipur',
  area: '3.25',
  recordNo: 'LR-0180-24',
  issueDate: '2021-08-12',
  status: 'Validated',
  signer: 'not-for-brokers',
};
const b = { ...a, owner: 'Arjun Mehta', survey: '91/4', village: 'Pune' };
test('location search returns recorded land owner', () =>
  assert.equal(searchLand([a, b], 'Jaipur', '')[0].owner, 'Aarav Sharma'));
test('partial land number search works across locations', () =>
  assert.equal(searchLand([a, b], '', '215')[0].survey, '215/3'));
test('combined filters must both match', () =>
  assert.deepEqual(searchLand([a, b], 'Pune', '215'), []));
test('empty search does not list the entire registry', () =>
  assert.deepEqual(searchLand([a, b], '', ''), []));
test('one-character global search is rejected', () =>
  assert.deepEqual(searchLand([a, b], '', '2'), []));
test('owner names are not land number search keys', () =>
  assert.deepEqual(searchLand([a, b], '', 'Aarav'), []));
test('conflict detected against full registry', () =>
  assert.equal(
    searchLand([a, { ...a, owner: 'Another claimant' }], 'Jaipur', '215')[0]
      .disputed,
    true,
  ));
test('broker results exclude document and signing metadata', () => {
  const result = searchLand([a], 'Jaipur', '')[0];
  assert.deepEqual(Object.keys(result).sort(), [
    'area',
    'disputed',
    'owner',
    'status',
    'survey',
    'village',
  ]);
});
