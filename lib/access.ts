// Demonstration policy only. Real authorization must run on a trusted server.
export type Profile = 'official' | 'public' | 'broker';
export type OwnershipDetails = {
  owner: string;
  survey: string;
  village: string;
  area: string;
  recordNo: string;
  issueDate: string;
};
type Entry = OwnershipDetails & { status: string };
const exact = (value: string) => value.trim().toLowerCase();
const parcel = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function canManage(profile: Profile) {
  return profile === 'official';
}
export function matchingParcels<T extends Entry>(
  records: T[],
  survey: string,
  village: string,
): T[] {
  if (!survey.trim() || !village.trim()) return [];
  return records.filter(
    (record) =>
      parcel(record.survey) === parcel(survey) &&
      parcel(record.village) === parcel(village),
  );
}
export function checkOwnership(
  records: Entry[],
  details: OwnershipDetails,
): 'match' | 'no-match' | 'inconclusive' {
  if (
    Object.values(details).some((value) => !value.trim()) ||
    !Number.isFinite(Number(details.area)) ||
    Number(details.area) <= 0
  )
    return 'no-match';
  const candidates = matchingParcels(records, details.survey, details.village);
  const match = candidates.find(
    (record) =>
      (['owner', 'survey', 'village', 'recordNo', 'issueDate'] as const).every(
        (key) => exact(record[key]) === exact(details[key]),
      ) && Number(record.area) === Number(details.area),
  );
  if (!match) return 'no-match';
  if (candidates.length !== 1 || match.status === 'Needs review')
    return 'inconclusive';
  return 'match';
}
export function brokerLookup(
  records: Entry[],
  survey: string,
  village: string,
) {
  return matchingParcels(records, survey, village).map(
    ({ owner, survey, village, area, status }) => ({
      owner,
      survey,
      village,
      area,
      status,
    }),
  );
}

export function searchLand(
  records: Entry[],
  locality: string,
  surveyQuery: string,
) {
  const location = exact(locality);
  const query = parcel(surveyQuery);
  if (!location && query.length < 2) return [];
  return records
    .filter(
      (record) =>
        (!location || exact(record.village) === location) &&
        (!query || parcel(record.survey).includes(query)),
    )
    .map(({ owner, survey, village, area, status }) => ({
      owner,
      survey,
      village,
      area,
      status,
      disputed:
        matchingParcels(records, survey, village).length > 1 ||
        status === 'Needs review',
    }));
}
