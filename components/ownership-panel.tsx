'use client';

import { useState } from 'react';
import { Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  brokerLookup,
  checkOwnership,
  type OwnershipDetails,
  type Profile,
} from '@/lib/access';

const empty: OwnershipDetails = {
  owner: '',
  survey: '',
  village: '',
  area: '',
  recordNo: '',
  issueDate: '',
};
const labels: Record<keyof OwnershipDetails, string> = {
  owner: 'Exact owner name',
  survey: 'Survey / parcel number',
  village: 'Village / locality',
  area: 'Area in acres',
  recordNo: 'Record number',
  issueDate: 'Issue date',
};

export function OwnershipPanel({
  profile,
  records,
}: {
  profile: Profile;
  records: Array<OwnershipDetails & { status: string }>;
}) {
  const broker = profile === 'broker';
  const [details, setDetails] = useState(empty);
  const [result, setResult] = useState<ReturnType<
    typeof checkOwnership
  > | null>(null);
  const [owners, setOwners] = useState<ReturnType<typeof brokerLookup> | null>(
    null,
  );
  const fields: Array<keyof OwnershipDetails> = broker
    ? ['survey', 'village']
    : ['owner', 'survey', 'village', 'area', 'recordNo', 'issueDate'];
  const conflict =
    owners &&
    (owners.length > 1 ||
      owners.some((owner) => owner.status === 'Needs review'));
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-7">
        <p className="text-sm font-semibold text-teal-700">
          {broker ? 'Broker workspace' : 'Public verification'}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {broker
            ? 'Find recorded parcel ownership'
            : 'Verify ownership details'}
        </h1>
        <p className="mt-3 text-base leading-6 text-slate-600">
          {broker
            ? 'Enter the parcel identifier and locality to view the recorded owner and any unresolved claims.'
            : 'Enter all six details exactly as shown on your record. You will receive a match result, not access to the registry.'}
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (broker)
            setOwners(brokerLookup(records, details.survey, details.village));
          else setResult(checkOwnership(records, details));
        }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field}>
              <Label htmlFor={`lookup-${field}`} className="mb-2 block text-sm">
                {labels[field]}
              </Label>
              <Input
                id={`lookup-${field}`}
                required
                type={
                  field === 'issueDate'
                    ? 'date'
                    : field === 'area'
                      ? 'number'
                      : 'text'
                }
                min={field === 'area' ? '0.01' : undefined}
                step={field === 'area' ? '0.01' : undefined}
                value={details[field]}
                onChange={(event) => {
                  setDetails((old) => ({
                    ...old,
                    [field]: event.target.value,
                  }));
                  setResult(null);
                  setOwners(null);
                }}
                className="h-11"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="h-11 bg-teal-700 px-5 text-white hover:bg-teal-800"
          >
            {broker ? (
              <Search className="mr-2 h-4 w-4" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {broker ? 'Look up parcel' : 'Verify exact details'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDetails(empty);
              setResult(null);
              setOwners(null);
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      <div aria-live="polite" className="mt-5">
        {result && (
          <div
            className={`rounded-2xl border p-5 ${result === 'match' ? 'border-teal-200 bg-teal-50 text-teal-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}
          >
            <h2 className="font-semibold">
              {result === 'match'
                ? 'Details match the registry'
                : result === 'inconclusive'
                  ? 'Ownership cannot be confirmed'
                  : 'No exact match found'}
            </h2>
            <p className="mt-2 text-sm leading-6">
              {result === 'match'
                ? 'All six supplied details match one reviewed record. This is a registry match, not a legal title certificate or a blockchain verification.'
                : result === 'inconclusive'
                  ? 'This parcel has an unresolved review or conflicting records. Ask an authorized official to investigate.'
                  : 'Check the details against your document and try again. No alternate owner or record information is disclosed.'}
            </p>
          </div>
        )}
        {owners && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">
              {owners.length ? 'Recorded ownership' : 'No parcel found'}
            </h2>
            {conflict && (
              <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Unresolved or conflicting claims. Do not treat these entries as
                confirmed ownership.
              </p>
            )}
            {owners.map((owner, index) => (
              <dl
                key={index}
                className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm"
              >
                <dt className="text-slate-500">Recorded owner</dt>
                <dd className="font-semibold">{owner.owner}</dd>
                <dt className="text-slate-500">Parcel / locality</dt>
                <dd>
                  {owner.survey} · {owner.village}
                </dd>
                <dt className="text-slate-500">Area</dt>
                <dd>{owner.area} acres</dd>
                <dt className="text-slate-500">Record status</dt>
                <dd>{owner.status}</dd>
              </dl>
            ))}
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {owners.length
                ? 'Read-only registry information. Original documents, full record details, export, and approval tools are restricted to the official view. This lookup is not a legal title certificate.'
                : 'Check both the parcel number and locality. Partial or name-only searches are not supported.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccessGuide() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-teal-700">Help & access</p>
      <h1 className="mt-1 text-3xl font-bold">
        The right tools for each profile
      </h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          [
            'Government official',
            'View all record fields and proof references. Digitize records, investigate review items, create proofs, and export session records.',
          ],
          [
            'Normal user',
            'Submit all six exact record details. Receive a match, no-match, or unresolved-review result without browsing other records.',
          ],
          [
            'Broker',
            'Look up a parcel by survey number and locality. View recorded owners, area, and status, without editing or exporting the registry.',
          ],
        ].map(([title, body]) => (
          <section
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
          </section>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">About this demonstration</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The profile selector demonstrates different workspaces; it is not
          sign-in or secure authorization. Records use sample data and remain in
          this session. Real privileged access requires authenticated accounts
          and server-side permissions before connecting personal records.
          Officials should download their session export before refreshing.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Verification checks the stored record, not legal ownership. Names and
          identifiers ignore case and surrounding spaces; all six field values
          must otherwise match. A conflicting or unreviewed parcel is never
          reported as confirmed.
        </p>
      </div>
    </div>
  );
}
