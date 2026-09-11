import schema from './apim-schema.json';

/**
 * Authoritative APIM operation/parameter schema — a trimmed copy of the
 * `catalog-client.json` recon capture from the sibling `cloude` project
 * (`recon/dev-portal-compare.js`, 2026-09-04: 127 operations, path/query/body
 * shapes confirmed IDENTICAL across Roman_QA_TEST / CC Test 1 / SmarshCR
 * Sales — the Parameters/Request-body tables come from the APIM level, not
 * per-company data, so this one snapshot is valid for every company this
 * suite targets). NOT re-derived live by this project — treat it as a
 * point-in-time reference, same caveat as any other recon artifact; re-pull
 * from the sibling project if the catalogue changes again (it has before —
 * see the "naming trap" note in `_helpers.ts` and every `*-api.spec.ts`
 * group-header comment).
 *
 * Used to:
 *  - resolve which fields APIM's own docs mark `required` for a given
 *    operation, when deciding what to add to `negative-fields-catalog.ts` /
 *    `boundary-fields-catalog.ts` (cross-referenced against the ALREADY
 *    live-confirmed DTO in `_helpers.ts` — a field only gets a probe added
 *    if it's both schema-required AND actually part of the working body;
 *    APIM's documented `required` flag has been wrong before — see
 *    "access-not-enforced" on Create Custom Role below);
 *  - generate a type-appropriate example value for a field type string
 *    (`exampleValueForType`) — a lightweight data provider for filling in a
 *    new probe's value without hand-picking one per field.
 */

export type ApimFieldType = string; // e.g. "string", "string/uuid", "integer/int32", "array<string>", "boolean", "number/double", "string/date-time"

export interface ApimField {
  name: string;
  type: ApimFieldType;
  required: boolean;
  enum?: string[] | null;
}

export interface ApimOperation {
  tag: string;
  name: string;
  method: string;
  path: string;
  pathParams: ApimField[];
  queryParams: ApimField[];
  body: ApimField[];
}

interface ApimSchemaFile {
  takenAt: string;
  gateway: string;
  operations: ApimOperation[];
}

const SCHEMA = schema as ApimSchemaFile;

/** Exact-name lookup within one catalogue group (case-sensitive, matches the operation's documented `name`). */
export function findOperation(group: string, name: string): ApimOperation | undefined {
  return SCHEMA.operations.find(op => op.tag === group && op.name === name);
}

/** Every body field APIM's own docs mark `required: true` for one operation. */
export function requiredBodyFields(group: string, name: string): ApimField[] {
  return (findOperation(group, name)?.body ?? []).filter(f => f.required);
}

/**
 * A plausible, type-appropriate example value for one APIM field type
 * string. Not a fuzzer — just enough to build a valid-looking probe value
 * without hand-picking one per field. `seed` lets callers get distinct
 * values across fields/calls (e.g. Date.now().toString(36)).
 */
export function exampleValueForType(type: ApimFieldType, seed = 'aqa'): unknown {
  if (type.startsWith('array<')) return [exampleValueForType(type.slice(6, -1), seed)];
  switch (type) {
    case 'string/uuid':
      // Not a real random GUID (no crypto dependency here) — good enough as
      // a syntactically-valid-looking placeholder; callers that need a REAL
      // resolvable id (e.g. a real agent/site id) resolve one live instead.
      return '00000000-0000-4000-8000-000000000000';
    case 'string/date-time':
      return new Date().toISOString();
    case 'string/email':
      return `${seed}@example.com`;
    case 'string/tel':
      return '+15555550100';
    case 'integer/int32':
    case 'integer/int64':
    case 'integer':
      return 1;
    case 'number/double':
    case 'number/float':
    case 'number':
      return 1.0;
    case 'boolean':
      return true;
    case 'object':
      return {};
    default:
      return `AQA ${seed}`;
  }
}
