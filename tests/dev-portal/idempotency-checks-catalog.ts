import { TARGET_CUSTOMER_ID, ruleDto, alertDto } from './_helpers';
import { NEG_FIELD_SPECS } from './negative-fields-catalog';
import type { IdempSpec } from './_idempotency-checks';

/**
 * Idempotency & retries scenarios, layered on the confirmed create-op bases
 * from `negative-fields-catalog.ts`.
 *
 * EXCLUDED:
 *  - `role-mgmt/create-custom-role` — Delete Custom Role console is broken, so
 *    neither `deleteDeleted` nor cleanup can run.
 *  - `agent-mgmt/create-agent` `updateNonexistent` — `Update Agent` is a
 *    confirmed 400 bug for ANY agent (BUG-update-agent-site-scoping), so a 400
 *    on a nonexistent id would be uninformative.
 *  - `group-mgmt/create-agent-group` `doubleCreate` / `deleteDeleted` — the
 *    response `id:0` bug (P1-CREATE-AGENT-GROUP-ID-ZERO) means `identify`
 *    keys on the group NAME, which can't tell "same object" from "second
 *    object with the same name", and can't feed a delete-by-id.
 *
 * All expectations are `hypothesis` — nothing about idempotency is CONFIRMED
 * for these ops. The matrix records; it only soft-flags the likely-bug shapes
 * (`STALE-5XX`, `PHANTOM-WRITE`).
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

const NEG = new Map(NEG_FIELD_SPECS.map(s => [s.id, s]));
const b = (id: string) => {
  const s = NEG.get(id);
  if (!s) throw new Error(`idempotency-checks-catalog: no NEG_FIELD_SPEC "${id}"`);
  return s;
};
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
const BOGUS_INT = 999_999_999;

export const IDEMPOTENCY_SPECS: IdempSpec[] = [
  {
    base: b('ext-mgmt/create-extension'),
    scenarios: {
      doubleCreate: { expectSecond: 'unknown' },
      deleteDeleted: { deleteMatch: /^Delete Extension/, deleteParams: c => [['extensionId', c.extensionId], ['isArchive', 'false']] },
      updateNonexistent: { updateMatch: /^Update Extension/, body: badId => ({ id: badId, name: 'AQAidemnx', siteId: badId }) },
    },
  },
  {
    base: b('site-mgmt/add-site'),
    scenarios: {
      doubleCreate: { expectSecond: 'new-object' },
      deleteDeleted: { deleteMatch: /^Delete Site/, deleteParams: c => [['siteId', c.siteId]] },
      updateNonexistent: { updateMatch: /^Update Site/, body: badId => ({ id: badId, name: 'AQA idem nx' }) },
    },
  },
  {
    base: b('tag-mgmt/add-tag'),
    scenarios: {
      doubleCreate: { expectSecond: 'unknown' },
      deleteDeleted: { deleteMatch: /^Delete Tag/, deleteParams: c => [['tagId', c.tagId]] },
      updateNonexistent: { updateMatch: /^Update Tag/, body: badId => ({ id: badId, name: 'AQAidemnx' }) },
    },
  },
  {
    base: b('ip-whitelist/add'),
    // no params-based Delete IP Whitelist and no Update op → only double-create
    scenarios: {
      doubleCreate: { expectSecond: 'unknown' }, // dedup on ipAddress is plausible → could reject
    },
  },
  {
    base: b('group-mgmt/create-agent-group'),
    scenarios: {
      updateNonexistent: {
        updateMatch: /^Update Agent Group/,
        body: () => ({ id: BOGUS_INT, customerId: TARGET_CUSTOMER_ID, name: 'AQA idem nx', isActive: true, agentJson: '[]' }),
      },
    },
  },
  {
    base: b('notifications/add-notification-rule'),
    scenarios: {
      doubleCreate: { expectSecond: 'new-object' },
      deleteDeleted: { deleteMatch: /^Delete Notification Rule/, deleteParams: c => [['id', c.ruleId]] },
      updateNonexistent: { updateMatch: /^Update Notification Rule/, body: badId => ruleDto('AQA idem nx', [], badId) },
    },
  },
  {
    base: b('notifications/upsert-alert-configuration'),
    scenarios: {
      doubleCreate: { expectSecond: 'new-object' }, // id:null both times → upsert creates a 2nd config
      deleteDeleted: { deleteMatch: /^Delete Alert Configuration/, deleteParams: c => [['notificationId', c.alertId]] },
      updateNonexistent: { updateMatch: /^Upsert Alert Configuration/, body: () => alertDto('AQA idem nx', BOGUS_INT) },
    },
  },
  {
    base: b('calls/add-call-note'),
    scenarios: {
      doubleCreate: { expectSecond: 'new-object' },
      deleteDeleted: { deleteMatch: /^Delete Call Note/, deleteParams: c => [['callId', c.callId], ['noteId', c.noteId]] },
      updateNonexistent: {
        updateMatch: /^Update Call Note/,
        body: badId => ({ noteId: badId, note: 'AQA idem nx' }),
        params: (badId, c) => [['callId', c.callId], ['noteId', badId]],
      },
    },
  },
  {
    base: b('agent-mgmt/create-agent'),
    scenarios: {
      doubleCreate: { expectSecond: 'new-object' },
      deleteDeleted: { deleteMatch: /^Delete Agent \(/, deleteParams: c => [['agentId', c.agentId]] },
      // Update Agent is a confirmed 400 bug for any agent — updateNonexistent omitted.
    },
  },
  {
    base: b('agent-mgmt/create-agent-extension-mapping'),
    scenarios: {
      doubleCreate: { expectSecond: 'unknown' }, // agent now has an extension → 2nd map plausibly 400/409
      deleteDeleted: { deleteMatch: /^Delete Agent Extension/, deleteParams: c => [['id', c.mappingId]] },
      updateNonexistent: { updateMatch: /^Update Agent Extension/, body: badId => ({ id: badId, agentId: ZERO_GUID, extensionId: ZERO_GUID }) },
    },
  },
];
