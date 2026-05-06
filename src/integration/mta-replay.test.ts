/**
 * Module 9 — MTA replay integration test.
 *
 * Builds an end-to-end audit log: bind through MTA committed,
 * then asserts that replay() reconstructs the post-MTA state
 * (in-force-with-mta · v2 · POL-29481 + Manchester).
 */

import { describe, expect, it } from 'vitest';
import { replay } from '@/store/replay';
import type { AuditEvent } from '@/lib/audit';
import { getGreenlineBrokerSubmission } from '@/lib/fixtures';

const SUB_ID = 'sub_greenline_2026_05';
const POL_REF = 'POL-29481';

let counter = 0;
const id = () => `evt_${(++counter).toString(36)}`;

function ev(e: Record<string, unknown>): AuditEvent {
  return { id: id(), ...e } as unknown as AuditEvent;
}

function boundLog(): AuditEvent[] {
  return [
    ev({
      at: '2026-05-09T08:14:00Z',
      actor: { kind: 'broker', id: 'Sarah Whitfield' },
      kind: 'submission.created',
      submissionId: SUB_ID,
      folio: 'MGA-PAS · folio 29481',
      broker: 'Sarah Whitfield',
      submission: getGreenlineBrokerSubmission(),
    }),
    ev({
      at: '2026-05-09T14:14:14Z',
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'bind.committed',
      submissionId: SUB_ID,
      policyRef: POL_REF,
      premium: 38_265,
      signedBy: 'nm',
      hashes: [],
    }),
  ];
}

describe('MTA replay — bind → MTA committed', () => {
  it('reconstructs the in-force-with-mta state with v2 + Manchester endorsement', () => {
    const events: AuditEvent[] = [
      ...boundLog(),
      ev({
        at: '2026-08-01T09:00:00+01:00',
        actor: { kind: 'broker', id: 'Sarah Whitfield' },
        kind: 'mta.requestReceived',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        broker: 'Sarah Whitfield',
        subject: 'MTA — add Manchester',
        effectiveDate: '2026-08-01T00:00:00+01:00',
        changeType: 'add-site',
      }),
      ev({
        at: '2026-08-01T09:00:32+01:00',
        actor: { kind: 'system', modelVersion: 'sonnet-4-7' },
        kind: 'mta.extracted',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        fields: {
          effectiveDate: '2026-08-01T00:00:00+01:00',
          changeType: 'add-site',
          newSite: { name: 'Manchester' },
          newTurnover: 10_100_000,
          newSiteCount: 4,
        },
        avgConfidence: 0.93,
        fieldCount: 8,
      }),
      ev({
        at: '2026-08-01T09:00:32+01:00',
        actor: { kind: 'system' },
        kind: 'mta.gapFlagged',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        gapId: 'GAP-MTA-001',
        description: 'EA permit pending',
      }),
      ev({
        at: '2026-08-01T09:01:14+01:00',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'mta.gapResolved',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        gapId: 'GAP-MTA-001',
        choice: 'conditional',
        reason: 'broker confirmed install date matches permit application timeline',
        resolvedBy: 'nm',
      }),
      ev({
        at: '2026-08-01T09:01:30+01:00',
        actor: { kind: 'system' },
        kind: 'mta.deltaRated',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        beforePremium: 38_265,
        afterAnnualEquivalent: 49_315,
        annualDelta: 11_050,
        daysRemaining: 288,
        daysInTerm: 365,
        proRatedAP: 8_720,
        sha: 'sha-9d4c',
      }),
      ev({
        at: '2026-08-01T09:01:32+01:00',
        actor: { kind: 'system' },
        kind: 'mta.capacityRechecked',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        deltaConsumption: 7_183,
        newTotalConsumption: 32_055,
        sufficient: true,
      }),
      ev({
        at: '2026-08-01T09:01:35+01:00',
        actor: { kind: 'system' },
        kind: 'mta.scheduleGenerated',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        scheduleRef: 'POL-29481-MTA-01',
        endorsementNote: 'This endorsement adds Manchester …',
        addedWarranty: 'EA permit must be in force within 60 days',
      }),
      ev({
        at: '2026-08-01T09:02:01+01:00',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'mta.hashConfirmed',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        hashId: 'delta-premium',
        artefactSha: 'sha-9d4c',
        confirmedBy: 'nm',
      }),
      ev({
        at: '2026-08-01T09:02:08+01:00',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'mta.hashConfirmed',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        hashId: 'capacity-update',
        artefactSha: 'sha-cap2',
        confirmedBy: 'nm',
      }),
      ev({
        at: '2026-08-01T09:02:14+01:00',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'mta.committed',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        scheduleRef: 'POL-29481-MTA-01',
        endorsementNumber: 1,
        proRatedAP: 8_720,
        afterAnnualEquivalent: 49_315,
        effectiveDate: '2026-08-01T00:00:00+01:00',
        signedBy: 'nm',
        hashes: [],
      }),
      ev({
        at: '2026-08-01T09:02:14+01:00',
        actor: { kind: 'system' },
        kind: 'subjectivity.created',
        submissionId: SUB_ID,
        subjectivityId: 'SUBJ-101',
        subjectivityType: 'permit-warranty',
        description: 'Manchester EA permit must be in force within 60 days',
        affectedSites: ['Manchester'],
        criticalDate: '2026-09-30T00:00:00+01:00',
        actionRequired: 'Obtain EAWML-77890 by 30 September',
        autoMonitor: true,
      }),
      ev({
        at: '2026-08-01T09:18:00+01:00',
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'mta.scheduleSent',
        submissionId: SUB_ID,
        mtaId: 'MTA-04',
        scheduleRef: 'POL-29481-MTA-01',
        recipient: 's.whitfield@surestep.co.uk',
        coveringNote: 'Hi Sarah …',
        sentBy: 'nm',
      }),
    ];

    const r = replay(events);

    // Submission state advanced through bound → mta-pending → in-force-with-mta.
    expect(r.submissionState).toBe('in-force-with-mta');

    // Bind state still committed.
    expect(r.bind.phase).toBe('committed');
    expect(r.bind.policyRef).toBe(POL_REF);

    // MTA replayed end-to-end.
    expect(r.mta.phase).toBe('sent');
    expect(r.mta.request?.id).toBe('MTA-04');
    expect(r.mta.delta?.proRatedAP).toBe(8_720);
    expect(r.mta.delta?.afterAnnualEquivalent).toBe(49_315);
    expect(r.mta.capacity?.sufficient).toBe(true);
    expect(r.mta.schedule?.scheduleRef).toBe('POL-29481-MTA-01');
    expect(r.mta.hashes).toHaveLength(2);
    expect(r.mta.hashes.every((h) => h.status === 'confirmed')).toBe(true);
    expect(r.mta.committedAt).not.toBeNull();
    expect(r.mta.sentAt).not.toBeNull();

    // Policy version stack carries the new endorsement.
    expect(r.policy.versions).toHaveLength(1);
    expect(r.policy.versions[0]!.endorsementNumber).toBe(1);
    expect(r.policy.versions[0]!.afterAnnualEquivalent).toBe(49_315);

    // Subjectivities now include the Manchester permit warranty.
    expect(
      r.postBind.subjectivities.some((s) => s.id === 'SUBJ-101'),
    ).toBe(true);

    // Lifecycle 'now' advanced to MTA-04.
    // (The test uses replay only; lifecycle.cursor/now are managed by
    // the store reducer not the pure replay, so we don't assert them
    // here.)
  });
});
