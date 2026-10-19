import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTenantDbById } from '../../src/db/connectionManager.js';
import { signToken } from '../../src/middleware/auth.js';
import app from '../../server.js';

describe('Event Creation and Student Participation (Full Specification & Lifecycle)', () => {
  let server;
  let baseUrl;
  let academy1Db;
  let academy2Db;
  let academy1AdminToken;
  let academy2AdminToken;
  let student1Token;
  let student2Token;
  let uninvitedStudentToken;

  const ACADEMY_1_ID = 1;
  const ACADEMY_2_ID = 2;

  let student1Id;
  let student2Id;
  let uninvitedStudentId;
  let createdEventId;

  before(async () => {
    process.env.NODE_ENV = 'test';
    academy1Db = getTenantDbById(ACADEMY_1_ID);
    academy2Db = getTenantDbById(ACADEMY_2_ID);

    // Clean up any test events from previous test runs
    academy1Db.prepare("DELETE FROM events WHERE title LIKE 'Test %' OR title LIKE 'Inter-Branch Karate Tournament%'").run();

    // Query existing students in Academy 1
    const students = academy1Db.prepare('SELECT id, first_name, last_name, email FROM students LIMIT 3').all();
    assert.ok(students.length >= 3, 'Academy 1 should have at least 3 students for participation testing');

    student1Id = students[0].id;
    student2Id = students[1].id;
    uninvitedStudentId = students[2].id;

    // Tokens
    academy1AdminToken = signToken({
      userId: 1,
      email: 'john.smith@mahavirsportsacademy.com',
      role: 'academy_admin',
      academyId: ACADEMY_1_ID,
      name: 'John Smith',
      permissions: ['events.view', 'events.create', 'events.update', 'events.manage_eligibility', 'events.view_responses', 'events.approve_registration', 'events.export'],
    });

    academy2AdminToken = signToken({
      userId: 2,
      email: 'admin@sardar-martial-arts.com',
      role: 'academy_admin',
      academyId: ACADEMY_2_ID,
      name: 'Sardar Admin',
    });

    student1Token = signToken({
      userId: student1Id,
      studentId: student1Id,
      email: students[0].email,
      role: 'student',
      academyId: ACADEMY_1_ID,
      name: `${students[0].first_name} ${students[0].last_name}`,
    });

    student2Token = signToken({
      userId: student2Id,
      studentId: student2Id,
      email: students[1].email,
      role: 'student',
      academyId: ACADEMY_1_ID,
      name: `${students[1].first_name} ${students[1].last_name}`,
    });

    uninvitedStudentToken = signToken({
      userId: uninvitedStudentId,
      studentId: uninvitedStudentId,
      email: students[2].email,
      role: 'student',
      academyId: ACADEMY_1_ID,
      name: `${students[2].first_name} ${students[2].last_name}`,
    });

    // Start HTTP server on random port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, data: json, text };
  }

  // =========================================================================
  // REQUIREMENT 1 & 2: DRAFT EVENT CREATION MATCHING SPECIFICATION
  // =========================================================================
  it('1. Successfully creates draft event matching initial specification without venue', async () => {
    const payload = {
      title: 'Inter-Branch Karate Tournament',
      event_type: 'tournament',
      event_date: '2026-11-15',
      rsvp_deadline: '2026-11-05',
      location: null, // Initial specification: Venue not specified yet
      registration_approval_required: 1, // Configurable approval required
      description: 'Annual inter-branch karate kumite and kata tournament.',
      eligible_student_ids: [student1Id, student2Id], // Individually selected students
    };

    const res = await api('/api/academy/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201, `Failed to create event: ${JSON.stringify(res.data)}`);
    assert.equal(res.data.success, true);
    assert.ok(res.data.eventId, 'Should return eventId');
    createdEventId = res.data.eventId;

    // Verify database persistence in tenant DB
    const event = academy1Db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    assert.ok(event, 'Event must be persisted in tenant database');
    assert.equal(event.title, 'Inter-Branch Karate Tournament');
    assert.equal(event.type, 'tournament');
    assert.equal(event.status, 'draft');
    assert.equal(event.location, null);
    assert.equal(event.registration_approval_required, 1);
    assert.equal(event.eligibility_snapshot_version, 0);

    // Verify participants were seeded in draft
    const participants = academy1Db.prepare('SELECT * FROM event_participants WHERE event_id = ?').all(createdEventId);
    assert.equal(participants.length, 2);
    assert.equal(participants[0].status, 'invited');
    assert.equal(participants[1].status, 'invited');
  });

  // =========================================================================
  // REQUIREMENT 3 & 6: PUBLICATION GATES & VALIDATION
  // =========================================================================
  it('2. Fails to publish draft event when mandatory venue/location is missing', async () => {
    const res = await api(`/api/academy/events/${createdEventId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
    });

    assert.equal(res.status, 422, 'Should reject publication with 422 Unprocessable Entity');
    assert.equal(res.data.success, false);
    assert.ok(
      res.data.errors.some((e) => e.includes('Venue/location is required')),
      `Expected venue validation error, got: ${JSON.stringify(res.data.errors)}`
    );

    // Event should remain in draft
    const event = academy1Db.prepare('SELECT status FROM events WHERE id = ?').get(createdEventId);
    assert.equal(event.status, 'draft');
  });

  it('3. Fails to update event with invalid RSVP deadline greater than event date', async () => {
    const res = await api(`/api/academy/events/${createdEventId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify({
        title: 'Inter-Branch Karate Tournament',
        event_type: 'tournament',
        event_date: '2026-11-15',
        rsvp_deadline: '2026-11-20', // Invalid: after event date!
        location: 'Main Dojo Arena',
        registration_approval_required: 1,
        eligible_student_ids: [student1Id],
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.error.includes('RSVP deadline must be on or before the event date'));
  });

  // =========================================================================
  // REQUIREMENT 4 & 5: PUBLICATION & VERSIONED ELIGIBILITY SNAPSHOTTING
  // =========================================================================
  it('4. Successfully publishes event once venue is set and creates versioned snapshot (v1)', async () => {
    // 1. Update event with venue
    const updateRes = await api(`/api/academy/events/${createdEventId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify({
        title: 'Inter-Branch Karate Tournament',
        event_type: 'tournament',
        event_date: '2026-11-15',
        rsvp_deadline: '2026-11-05',
        location: 'Main Dojo Arena, North Campus',
        registration_approval_required: 1,
        eligible_student_ids: [student1Id, student2Id],
      }),
    });
    assert.equal(updateRes.status, 200);

    // 2. Publish event
    const publishRes = await api(`/api/academy/events/${createdEventId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
    });

    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.data.success, true);
    assert.equal(publishRes.data.snapshotVersion, 1);

    // Verify DB state
    const event = academy1Db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    assert.equal(event.status, 'published');
    assert.equal(event.location, 'Main Dojo Arena, North Campus');
    assert.equal(event.eligibility_snapshot_version, 1);
    assert.ok(event.published_at, 'published_at must be populated');

    // Verify participant snapshot versions
    const participants = academy1Db.prepare('SELECT * FROM event_participants WHERE event_id = ?').all(createdEventId);
    assert.equal(participants.length, 2);
    for (const p of participants) {
      assert.equal(p.snapshot_version, 1);
      assert.equal(p.status, 'invited');
      assert.equal(p.registration_status, 'pending');
    }
  });

  // =========================================================================
  // REQUIREMENT 13: TENANT ISOLATION
  // =========================================================================
  it('5. Strictly enforces tenant isolation: Academy 2 cannot view or modify Academy 1 events', async () => {
    // Academy 2 attempts to fetch Academy 1's event
    const res = await api(`/api/academy/events/${createdEventId}`, {
      headers: { Authorization: `Bearer ${academy2AdminToken}` },
    });

    assert.equal(res.status, 404, 'Event should not exist in Academy 2 database');

    // Academy 2 list events
    const listRes = await api('/api/academy/events', {
      headers: { Authorization: `Bearer ${academy2AdminToken}` },
    });
    assert.equal(listRes.status, 200);
    const hasEvent = listRes.data.events.some((e) => e.id === createdEventId);
    assert.equal(hasEvent, false, 'Academy 1 event must not appear in Academy 2 events list');
  });

  // =========================================================================
  // REQUIREMENT 7 & 8: STUDENT VIEW AND PARTICIPATION RESPONSE
  // =========================================================================
  it('6. Eligible student sees published invitation and responds Interested (Pending approval)', async () => {
    // Student 1 checks invitations
    const listRes = await api('/api/student/events', {
      headers: { Authorization: `Bearer ${student1Token}` },
    });

    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.events.length >= 1);
    const invitation = listRes.data.events.find((e) => e.id === createdEventId);
    assert.ok(invitation, 'Student 1 must see invitation');
    assert.equal(invitation.my_response, 'no_response');

    // Student 1 responds "interested"
    const respondRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: JSON.stringify({ response: 'interested', notes: 'Excited to compete in Kumite!' }),
    });

    assert.equal(respondRes.status, 200);
    assert.equal(respondRes.data.success, true);
    assert.equal(respondRes.data.response, 'interested');
    assert.equal(respondRes.data.registration_status, 'pending', 'Expressing interest must NOT automatically confirm registration');

    // Verify response in DB
    const participant = academy1Db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND student_id = ?').get(createdEventId, student1Id);
    assert.equal(participant.status, 'interested');
    assert.equal(participant.registration_status, 'pending');
    assert.ok(participant.responded_at);

    // Verify response history recorded
    const history = academy1Db.prepare('SELECT * FROM event_response_history WHERE event_id = ? AND student_id = ? ORDER BY id DESC').all(createdEventId, student1Id);
    assert.ok(history.length >= 1);
    assert.equal(history[0].previous_status, 'invited');
    assert.equal(history[0].new_status, 'interested');
  });

  it('7. Student 2 responds Not interested and keeps No response distinct from Not invited', async () => {
    const respondRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student2Token}` },
      body: JSON.stringify({ response: 'not_interested', notes: 'Unavailable on tournament weekend' }),
    });

    assert.equal(respondRes.status, 200);
    assert.equal(respondRes.data.response, 'not_interested');
    assert.equal(respondRes.data.registration_status, 'rejected');

    // Uninvited student checks invitations
    const uninvitedRes = await api('/api/student/events', {
      headers: { Authorization: `Bearer ${uninvitedStudentToken}` },
    });
    const found = uninvitedRes.data.events.some((e) => e.id === createdEventId);
    assert.equal(found, false, 'Uninvited student must not see the event in their portal');

    // Uninvited student attempts to submit response
    const forbiddenRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${uninvitedStudentToken}` },
      body: JSON.stringify({ response: 'interested' }),
    });
    assert.equal(forbiddenRes.status, 400);
    assert.ok(forbiddenRes.data.error.includes('Student is not eligible or invited for this event'));
  });

  it('8. Student can update their response before deadline with full audit tracking', async () => {
    // Student 1 changes response from interested to not_interested
    const changeRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: JSON.stringify({ response: 'not_interested', notes: 'Schedule conflict arose' }),
    });

    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.data.response, 'not_interested');

    // Student 1 changes back to interested
    const backRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: JSON.stringify({ response: 'interested', notes: 'Conflict resolved, ready to compete' }),
    });
    assert.equal(backRes.status, 200);
    assert.equal(backRes.data.response, 'interested');

    // Verify response history entries
    const history = academy1Db.prepare('SELECT * FROM event_response_history WHERE event_id = ? AND student_id = ? ORDER BY id ASC').all(createdEventId, student1Id);
    assert.equal(history.length, 3, 'Must have recorded initial response and 2 subsequent changes');
  });

  // =========================================================================
  // REQUIREMENT 9: DEADLINE ENFORCEMENT
  // =========================================================================
  it('9. Enforces registration deadline: rejects responses after RSVP deadline has passed', async () => {
    // Temporarily set rsvp_deadline to yesterday
    academy1Db.prepare("UPDATE events SET rsvp_deadline = date('now', '-1 day') WHERE id = ?").run(createdEventId);

    const lateRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student1Token}` },
      body: JSON.stringify({ response: 'not_interested' }),
    });

    assert.equal(lateRes.status, 400);
    assert.ok(lateRes.data.error.includes('Response deadline has passed'), `Expected deadline error, got ${lateRes.data.error}`);

    // Restore valid deadline
    academy1Db.prepare("UPDATE events SET rsvp_deadline = '2026-11-05' WHERE id = ?").run(createdEventId);
  });

  // =========================================================================
  // REQUIREMENT 11 & 12: REGISTRATION APPROVAL WORKFLOW
  // =========================================================================
  it('10. Organizer approves student registration from Pending to Confirmed', async () => {
    const participant = academy1Db.prepare('SELECT id FROM event_participants WHERE event_id = ? AND student_id = ?').get(createdEventId, student1Id);

    const approveRes = await api(`/api/academy/events/${createdEventId}/participants/${participant.id}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify({ registration_status: 'confirmed', notes: 'Weight category verified. Registration approved.' }),
    });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.success, true);
    assert.equal(approveRes.data.registration_status, 'confirmed');

    // Verify DB columns
    const updated = academy1Db.prepare('SELECT * FROM event_participants WHERE id = ?').get(participant.id);
    assert.equal(updated.registration_status, 'confirmed');
    assert.equal(updated.approved_by, 1);
    assert.ok(updated.approved_at);
  });

  // =========================================================================
  // REQUIREMENT 10: ELIGIBILITY ROSTER SNAPSHOT PRESERVATION
  // =========================================================================
  it('11. Updating eligible students creates versioned snapshot (v2) and preserves existing responses', async () => {
    // Add uninvitedStudentId to eligible list
    const updateRes = await api(`/api/academy/events/${createdEventId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify({
        title: 'Inter-Branch Karate Tournament',
        event_type: 'tournament',
        event_date: '2026-11-15',
        rsvp_deadline: '2026-11-05',
        location: 'Main Dojo Arena, North Campus',
        registration_approval_required: 1,
        eligible_student_ids: [student1Id, student2Id, uninvitedStudentId], // Adding student 3
      }),
    });

    assert.equal(updateRes.status, 200);

    const event = academy1Db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    assert.equal(event.eligibility_snapshot_version, 2, 'Snapshot version must increment to 2');

    // Existing Student 1 must STILL be interested and confirmed!
    const p1 = academy1Db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND student_id = ?').get(createdEventId, student1Id);
    assert.equal(p1.status, 'interested', 'Existing response must NOT be wiped out by roster change');
    assert.equal(p1.registration_status, 'confirmed', 'Existing confirmed registration must be preserved');
    assert.equal(p1.snapshot_version, 2);

    // Newly added student must be in draft/invited state
    const p3 = academy1Db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND student_id = ?').get(createdEventId, uninvitedStudentId);
    assert.ok(p3, 'Newly invited student must exist');
    assert.equal(p3.status, 'invited');
  });

  // =========================================================================
  // CAPACITY & WAITLISTING
  // =========================================================================
  it('12. Enforces event capacity limit and assigns waitlisted status when capacity is full', async () => {
    // Set max_participants to 1 (Student 1 is already confirmed)
    academy1Db.prepare('UPDATE events SET max_participants = 1 WHERE id = ?').run(createdEventId);

    // UninvitedStudent (now invited) responds "interested"
    const respondRes = await api(`/api/student/events/${createdEventId}/respond`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${uninvitedStudentToken}` },
      body: JSON.stringify({ response: 'interested' }),
    });

    assert.equal(respondRes.status, 200);
    // Student is waitlisted because capacity (1) is already reached by confirmed student 1!
    assert.equal(respondRes.data.registration_status, 'waitlisted', 'Expected waitlisted registration status due to max capacity');
  });

  // =========================================================================
  // AUDIT TRAIL & ROSTER EXPORT
  // =========================================================================
  it('13. Exports event roster with full student details, responses, and registration decisions', async () => {
    const exportRes = await api(`/api/academy/events/${createdEventId}/export`, {
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
    });

    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.text.includes('Student Code,Student Name,Branch,Batch,Response Status,Registration Status'));
    assert.ok(exportRes.text.includes('interested'));
    assert.ok(exportRes.text.includes('confirmed'));
  });

  it('14. Cancels event with mandatory reason and records audit log', async () => {
    const cancelRes = await api(`/api/academy/events/${createdEventId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${academy1AdminToken}` },
      body: JSON.stringify({ cancellation_reason: 'Inclement weather conditions and facility maintenance.' }),
    });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.success, true);

    const event = academy1Db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    assert.equal(event.status, 'cancelled');
    assert.equal(event.cancellation_reason, 'Inclement weather conditions and facility maintenance.');

    // Check audit logs
    const logs = academy1Db.prepare("SELECT * FROM audit_logs WHERE action IN ('events.created', 'events.published', 'events.cancelled') ORDER BY id ASC").all();
    assert.ok(logs.length >= 3, 'Audit trail must log creation, publication, and cancellation');
  });
});
