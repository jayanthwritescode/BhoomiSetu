'use client';

import { useState } from 'react';
import {
  Search,
  ShieldCheck,
  MapPinned,
  ArrowRight,
  ArrowLeft,
  UserRound,
  Check,
  AlertTriangle,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  searchLand,
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
const example: OwnershipDetails = {
  owner: 'Aarav Sharma',
  survey: '215/3',
  village: 'Jaipur',
  area: '3.25',
  recordNo: 'LR-0180-24',
  issueDate: '2021-08-12',
};
const labels: Record<keyof OwnershipDetails, string> = {
  owner: 'Claimed owner’s full name',
  survey: 'Land-parcel / survey number',
  village: 'Village, town or locality',
  area: 'Land area (acres)',
  recordNo: 'Land record number',
  issueDate: 'Record issue date',
};
type Entry = OwnershipDetails & { status: string };

export function OwnershipPanel({
  profile,
  records,
}: {
  profile: Profile;
  records: Entry[];
}) {
  return profile === 'broker' ? (
    <BrokerSearch records={records} />
  ) : (
    <UserVerification records={records} />
  );
}

function WorkspaceHeading({ broker }: { broker?: boolean }) {
  return (
    <div className="mb-7 flex items-start gap-4">
      <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 sm:flex">
        {broker ? (
          <MapPinned className="h-7 w-7" />
        ) : (
          <ShieldCheck className="h-7 w-7" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
          {broker ? 'Broker workspace' : 'User workspace'}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {broker
            ? 'Find who the land belongs to'
            : 'Verify a land ownership claim'}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          {broker
            ? 'Search the land registry by location and land-parcel number. See recorded owners, land area, and unresolved ownership claims.'
            : 'Supply the land details and claimed owner’s details. Only an exact-match result is returned—no other owner’s information is revealed.'}
        </p>
      </div>
    </div>
  );
}

function BrokerSearch({ records }: { records: Entry[] }) {
  const [location, setLocation] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof searchLand> | null>(
    null,
  );
  const [submitted, setSubmitted] = useState('');
  const [error, setError] = useState('');
  const localities = [
    ...new Set(records.map((record) => record.village)),
  ].sort();
  function search(nextLocation = location, nextQuery = query) {
    if (!nextLocation && nextQuery.trim().length < 2) {
      setError(
        'Choose a location or enter at least two characters of the land-parcel number.',
      );
      return;
    }
    setError('');
    setResults(searchLand(records, nextLocation, nextQuery));
    setSubmitted(
      [nextLocation || 'All locations', nextQuery.trim()]
        .filter(Boolean)
        .join(' · '),
    );
  }
  function clearResults() {
    setResults(null);
    setError('');
  }
  return (
    <div className="mx-auto max-w-5xl">
      <WorkspaceHeading broker />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      >
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Search className="h-4 w-4 text-teal-700" />
          Land registry search
        </div>
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1.2fr_auto]">
          <div>
            <Label htmlFor="land-location" className="mb-2 block">
              Location
            </Label>
            <select
              id="land-location"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                clearResults();
              }}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
            >
              <option value="">All locations</option>
              {localities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="land-number" className="mb-2 block">
              Land-parcel / survey number
            </Label>
            <Input
              id="land-number"
              value={query}
              placeholder="e.g. 215/3 or 215"
              onChange={(event) => {
                setQuery(event.target.value);
                clearResults();
              }}
              className="h-12 rounded-xl text-base"
            />
          </div>
          <Button
            type="submit"
            className="h-12 rounded-xl bg-teal-700 px-6 text-white hover:bg-teal-800"
          >
            <Search className="mr-2 h-4 w-4" />
            Search land
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-sm text-slate-500">
            Try a sample location:
          </span>
          {['Jaipur', 'Pune', 'Devanahalli'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLocation(value);
                setQuery('');
                search(value, '');
              }}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-teal-400 hover:bg-teal-50"
            >
              {value}
            </button>
          ))}
        </div>
      </form>
      <div className="mt-6" aria-live="polite">
        {results === null ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                'Search by land',
                'Use a location, a land-parcel number, or both. Partial land numbers are supported.',
              ],
              [
                'See recorded owners',
                'Results include the owner’s name, land area, and registry status.',
              ],
              [
                'Check for conflicts',
                'Disputed or overlapping claims are flagged before you proceed.',
              ],
            ].map(([title, body], index) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/70 p-5"
              >
                <span className="text-sm font-bold text-teal-700">
                  0{index + 1}
                </span>
                <h2 className="mt-3 font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {results.length} land record{results.length === 1 ? '' : 's'}{' '}
                  found
                </h2>
                <p className="mt-1 text-sm text-slate-500">{submitted}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setLocation('');
                  setQuery('');
                  clearResults();
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                New search
              </Button>
            </div>
            {!results.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Search className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 font-semibold">No matching land records</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try another location, remove the location filter, or shorten
                  the land-parcel number.
                </p>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {results.map((land, index) => (
                <article
                  key={index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <span className="font-semibold">
                      Land parcel {land.survey}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${land.disputed ? 'bg-amber-100 text-amber-900' : 'bg-sky-50 text-sky-800'}`}
                    >
                      {land.disputed ? 'Review required' : land.status}
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-slate-500">Recorded owner</p>
                    <h3 className="mt-1 text-xl font-bold">{land.owner}</h3>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Location</p>
                        <p className="mt-1 font-medium">{land.village}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Land area</p>
                        <p className="mt-1 font-medium">{land.area} acres</p>
                      </div>
                    </div>
                    {land.disputed && (
                      <p className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                        This land has overlapping claims or an unresolved
                        review. Ask an official to investigate.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-6 text-sm leading-6 text-slate-500">
        Registry information is read-only and is not a legal title certificate.
        Sample records are fictional. Approval, export, and full record
        documents belong to the official workspace.
      </p>
    </div>
  );
}

function UserVerification({ records }: { records: Entry[] }) {
  const [details, setDetails] = useState<OwnershipDetails>(empty);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<ReturnType<
    typeof checkOwnership
  > | null>(null);
  const [error, setError] = useState('');
  const [isExample, setIsExample] = useState(false);
  const fields: Array<keyof OwnershipDetails> =
    stage === 0
      ? ['survey', 'village', 'area']
      : ['owner', 'recordNo', 'issueDate'];
  function restart() {
    setDetails(empty);
    setStage(0);
    setResult(null);
    setError('');
    setIsExample(false);
  }
  return (
    <div className="mx-auto max-w-4xl">
      <WorkspaceHeading />
      <ol
        aria-label="Verification progress"
        className="mb-6 grid grid-cols-3 gap-2"
      >
        {['Land details', 'Owner details', 'Review & verify'].map(
          (label, index) => (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${stage === index ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-500'}`}
              aria-current={stage === index ? 'step' : undefined}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stage >= index ? 'bg-teal-700 text-white' : 'bg-slate-100'}`}
              >
                {stage > index ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          {stage === 0 ? (
            <MapPinned className="h-5 w-5 text-teal-700" />
          ) : stage === 1 ? (
            <UserRound className="h-5 w-5 text-teal-700" />
          ) : (
            <FileCheck2 className="h-5 w-5 text-teal-700" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {result
                ? 'Verification result'
                : [
                    'Identify the land',
                    'Identify the claimed owner',
                    'Review your submission',
                  ][stage]}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {stage === 0
                ? 'Enter the location and land details shown on your document.'
                : stage === 1
                  ? 'Enter the person and document details you want to verify.'
                  : 'Only the details you supplied are shown below.'}
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (stage < 2) {
              if (fields.some((field) => !details[field].trim())) {
                setError('Complete every field. Blank spaces are not valid.');
                return;
              }
              setError('');
              setStage(stage + 1);
            } else setResult(checkOwnership(records, details));
          }}
          className="p-6"
        >
          {stage < 2 ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field}>
                  <Label htmlFor={`verify-${field}`} className="mb-2 block">
                    {labels[field]}
                  </Label>
                  <Input
                    id={`verify-${field}`}
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
                      setError('');
                    }}
                    className="h-12 rounded-xl text-base"
                  />
                </div>
              ))}
            </div>
          ) : (
            <dl className="grid gap-5 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
              {(Object.keys(labels) as Array<keyof OwnershipDetails>).map(
                (field) => (
                  <div key={field}>
                    <dt className="text-sm text-slate-500">{labels[field]}</dt>
                    <dd className="mt-1 break-words font-semibold">
                      {details[field]}
                      {field === 'area' ? ' acres' : ''}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {isExample && (
            <p className="mt-4 text-sm text-slate-500">
              Fictional example loaded for testing. You can change any value to
              test a mismatch.
            </p>
          )}
          <div aria-live="polite">
            {result && (
              <div
                className={`mt-5 rounded-xl border p-5 ${result === 'match' ? 'border-teal-200 bg-teal-50 text-teal-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}
              >
                <h3 className="font-semibold">
                  {result === 'match'
                    ? 'Land and owner details match'
                    : result === 'inconclusive'
                      ? 'Unable to confirm this claim'
                      : 'Details do not match'}
                </h3>
                <p className="mt-2 text-sm leading-6">
                  {result === 'match'
                    ? 'All six supplied values match one reviewed registry record. This result is not identity authentication, a legal title certificate, or blockchain verification.'
                    : result === 'inconclusive'
                      ? 'The land has an unresolved review or conflicting claims. Contact an official; no alternate owner details are disclosed.'
                      : 'Check your land and owner details against your document. No other person’s name or record information is returned.'}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (stage === 0) restart();
                else {
                  setStage(stage - 1);
                  setResult(null);
                  setError('');
                }
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {stage === 0 ? 'Clear details' : 'Back'}
            </Button>
            {result ? (
              <Button
                type="button"
                onClick={restart}
                className="bg-teal-700 text-white hover:bg-teal-800"
              >
                Verify another claim
              </Button>
            ) : (
              <Button
                type="submit"
                className="h-11 bg-teal-700 px-5 text-white hover:bg-teal-800"
              >
                {stage === 2 ? 'Verify land & owner' : 'Continue'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
      {stage === 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/60 p-4">
          <p className="text-sm text-slate-600">
            Want to test the workflow? Use a fictional record.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setDetails(example);
              setResult(null);
              setError('');
              setIsExample(true);
            }}
          >
            Load sample details
          </Button>
        </div>
      )}
      <p className="mt-5 text-sm leading-6 text-slate-500">
        Your view does not offer owner discovery or registry browsing. Matching
        ignores case and surrounding spaces; the land, owner, and document
        values must otherwise match.
      </p>
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
            'Search land parcels by location and survey number. View recorded owners, area, and status, without editing or exporting the registry.',
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
          must otherwise match. A conflicting or unreviewed land parcel is never
          reported as confirmed.
        </p>
      </div>
    </div>
  );
}
