import { DateUtils } from '../utils/dateUtils.js';

export class EventService {
  /**
   * Helper to generate unique slug for an event within an academy
   */
  static generateSlug(db, title, currentId = null) {
    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let candidate = slug;
    let counter = 1;

    while (true) {
      const query = currentId
        ? db.prepare('SELECT id FROM events WHERE slug = ? AND id != ?').get(candidate, currentId)
        : db.prepare('SELECT id FROM events WHERE slug = ?').get(candidate);

      if (!query) return candidate;
      candidate = `${slug}-${counter++}`;
    }
  }

  /**
   * 1. Create a new event (defaults to 'draft')
   */
  static createEvent(db, academyId, data, actorId = null) {
    const {
      title,
      description,
      content,
      type = 'tournament',
      event_type,
      event_date,
      event_end_date,
      location,
      venue,
      fee = 0,
      max_participants,
      waitlist_enabled = 1,
      requires_rsvp = 1,
      rsvp_deadline,
      registration_approval_required = 0,
      eligibility_type = 'manual',
      eligibility_criteria,
      manual_participants,
      eligible_student_ids,
    } = data;

    const finalType = event_type || type || 'tournament';
    const finalLocation = location || venue || null;
    const finalManual = eligible_student_ids || manual_participants || [];

    if (!title || !title.trim()) {
      throw new Error('Event title is required');
    }
    if (!event_date) {
      throw new Error('Event start date is required');
    }

    const normalizedEventDate = DateUtils.parseAndNormalizeDate(event_date, { fieldName: 'Event start date', required: true });
    const normalizedEndDate = event_end_date ? DateUtils.parseAndNormalizeDate(event_end_date, { fieldName: 'Event end date' }) : null;
    const normalizedRsvpDeadline = rsvp_deadline ? DateUtils.parseAndNormalizeDate(rsvp_deadline, { fieldName: 'RSVP deadline' }) : null;

    if (normalizedEndDate && DateUtils.compareDates(normalizedEndDate, normalizedEventDate) < 0) {
      throw new Error('Event end date cannot be before event start date');
    }

    if (requires_rsvp && normalizedRsvpDeadline) {
      if (DateUtils.compareDates(normalizedRsvpDeadline, normalizedEventDate) > 0) {
        throw new Error('RSVP deadline must be on or before the event date');
      }
    }

    // Verify all manual participants belong to this academy
    let manualIds = Array.isArray(finalManual) ? finalManual.map(Number) : [];
    if (manualIds.length > 0) {
      const placeholders = manualIds.map(() => '?').join(',');
      const studentsInDb = db.prepare(`SELECT id FROM students WHERE id IN (${placeholders})`).all(...manualIds);
      if (studentsInDb.length !== manualIds.length) {
        throw new Error('One or more selected students do not belong to this academy');
      }
    } else if (eligibility_type === 'all') {
      const allActive = db.prepare("SELECT id FROM students WHERE status = 'active'").all();
      manualIds = allActive.map(s => s.id);
    }

    const slug = this.generateSlug(db, title);

    const stmt = db.prepare(`
      INSERT INTO events (
        academy_id, created_by, title, slug, description, content,
        type, status, event_date, event_end_date, location, venue,
        fee, max_participants, waitlist_enabled, requires_rsvp,
        rsvp_deadline, registration_approval_required, eligibility_type,
        eligibility_criteria, manual_participants, eligibility_snapshot_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const result = stmt.run(
      academyId,
      actorId || null,
      title.trim(),
      slug,
      description || null,
      content || null,
      finalType,
      normalizedEventDate,
      normalizedEndDate,
      finalLocation,
      venue || null,
      Number(fee) || 0,
      max_participants ? Number(max_participants) : null,
      waitlist_enabled ? 1 : 0,
      requires_rsvp ? 1 : 0,
      normalizedRsvpDeadline,
      registration_approval_required ? 1 : 0,
      eligibility_type,
      eligibility_criteria ? JSON.stringify(eligibility_criteria) : null,
      JSON.stringify(manualIds)
    );

    const eventId = result.lastInsertRowid;

    // Seed draft participants so organizers can review roster
    for (const studentId of manualIds) {
      const student = db.prepare('SELECT id, branch_id FROM students WHERE id = ?').get(studentId);
      const activeBatch = db.prepare("SELECT batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(studentId);
      const batchId = activeBatch ? activeBatch.batch_id : null;

      db.prepare(`
        INSERT INTO event_participants (
          event_id, student_id, branch_id, batch_id, status,
          registration_status, snapshot_version, payment_required
        ) VALUES (?, ?, ?, ?, 'invited', ?, 0, ?)
      `).run(
        eventId,
        studentId,
        student ? student.branch_id : null,
        batchId,
        registration_approval_required ? 'pending' : 'not_applicable',
        Number(fee) > 0 ? 1 : 0
      );
    }

    // Record audit trail
    this.recordAudit(db, academyId, 'events', eventId, 'created', { title, status: 'draft', event_date }, actorId);

    return {
      success: true,
      eventId,
      message: 'Event created successfully in draft status',
    };
  }

  /**
   * 2. Update an existing event
   */
  static updateEvent(db, academyId, eventId, data, actorId = null) {
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      throw new Error('Event not found');
    }

    if (existing.status === 'cancelled') {
      throw new Error('Cannot edit a cancelled event');
    }

    const {
      title = existing.title,
      description = existing.description,
      content = existing.content,
      type = existing.type,
      event_type,
      event_date = existing.event_date,
      event_end_date = existing.event_end_date,
      location = existing.location,
      venue = existing.venue,
      fee = existing.fee,
      max_participants = existing.max_participants,
      waitlist_enabled = existing.waitlist_enabled,
      requires_rsvp = existing.requires_rsvp,
      rsvp_deadline = existing.rsvp_deadline,
      registration_approval_required = existing.registration_approval_required,
      eligibility_type = existing.eligibility_type,
      eligibility_criteria = existing.eligibility_criteria,
      manual_participants,
      eligible_student_ids,
    } = data;

    const finalType = event_type || type || existing.type;
    const finalLocation = location || venue || existing.location || existing.venue;

    const normalizedEventDate = DateUtils.parseAndNormalizeDate(event_date, { fieldName: 'Event start date', required: true });
    const normalizedEndDate = event_end_date ? DateUtils.parseAndNormalizeDate(event_end_date, { fieldName: 'Event end date' }) : null;
    const normalizedRsvpDeadline = rsvp_deadline ? DateUtils.parseAndNormalizeDate(rsvp_deadline, { fieldName: 'RSVP deadline' }) : null;

    if (requires_rsvp && normalizedRsvpDeadline) {
      if (DateUtils.compareDates(normalizedRsvpDeadline, normalizedEventDate) > 0) {
        throw new Error('RSVP deadline must be on or before the event date');
      }
    }

    const isRosterUpdate = (eligible_student_ids !== undefined || manual_participants !== undefined);
    let manualIds = [];

    if (isRosterUpdate) {
      const rawManual = eligible_student_ids !== undefined ? eligible_student_ids : manual_participants;
      manualIds = Array.isArray(rawManual) ? rawManual.map(Number) : (typeof rawManual === 'string' ? JSON.parse(rawManual) : []);
      if (manualIds.length > 0) {
        const placeholders = manualIds.map(() => '?').join(',');
        const studentsInDb = db.prepare(`SELECT id FROM students WHERE id IN (${placeholders})`).all(...manualIds);
        if (studentsInDb.length !== manualIds.length) {
          throw new Error('One or more selected students do not belong to this academy');
        }
      }
    } else if (existing.manual_participants) {
      try {
        manualIds = JSON.parse(existing.manual_participants);
      } catch {
        manualIds = [];
      }
    }

    const slug = title !== existing.title ? this.generateSlug(db, title, eventId) : existing.slug;

    // Increment version if already published and roster changed
    let nextVersion = existing.eligibility_snapshot_version;
    if (existing.status === 'published' && isRosterUpdate) {
      nextVersion = (existing.eligibility_snapshot_version || 1) + 1;
    }

    db.prepare(`
      UPDATE events
      SET title = ?,
          slug = ?,
          description = ?,
          content = ?,
          type = ?,
          event_date = ?,
          event_end_date = ?,
          location = ?,
          venue = ?,
          fee = ?,
          max_participants = ?,
          waitlist_enabled = ?,
          requires_rsvp = ?,
          rsvp_deadline = ?,
          registration_approval_required = ?,
          eligibility_type = ?,
          eligibility_criteria = ?,
          manual_participants = ?,
          eligibility_snapshot_version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title.trim(),
      slug,
      description || null,
      content || null,
      finalType,
      normalizedEventDate,
      normalizedEndDate,
      finalLocation,
      venue || null,
      Number(fee) || 0,
      max_participants ? Number(max_participants) : null,
      waitlist_enabled ? 1 : 0,
      requires_rsvp ? 1 : 0,
      rsvp_deadline || null,
      registration_approval_required ? 1 : 0,
      eligibility_type,
      typeof eligibility_criteria === 'object' ? JSON.stringify(eligibility_criteria) : eligibility_criteria,
      JSON.stringify(manualIds),
      nextVersion,
      eventId
    );

    // Sync participants preserving existing responses
    if (isRosterUpdate) {
      for (const studentId of manualIds) {
        const student = db.prepare('SELECT id, branch_id FROM students WHERE id = ?').get(studentId);
        const activeBatch = db.prepare("SELECT batch_id FROM student_batch_enrollments WHERE student_id = ? AND status = 'active'").get(studentId);
        const batchId = activeBatch ? activeBatch.batch_id : null;

        const existingParticipant = db.prepare('SELECT id, status, registration_status FROM event_participants WHERE event_id = ? AND student_id = ?').get(eventId, studentId);

        if (!existingParticipant) {
          db.prepare(`
            INSERT INTO event_participants (
              event_id, student_id, branch_id, batch_id, status,
              registration_status, snapshot_version, payment_required
            ) VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)
          `).run(
            eventId,
            studentId,
            student ? student.branch_id : null,
            batchId,
            registration_approval_required ? 'pending' : 'not_applicable',
            nextVersion || 1,
            Number(fee) > 0 ? 1 : 0
          );
        } else {
          // PRESERVE response status and registration status!
          db.prepare('UPDATE event_participants SET snapshot_version = ? WHERE id = ?').run(nextVersion || 1, existingParticipant.id);
        }
      }
    }

    this.recordAudit(db, academyId, 'events', eventId, 'updated', { title, venue: finalLocation, event_date, snapshot_version: nextVersion }, actorId);

    return {
      success: true,
      message: 'Event updated successfully',
    };
  }

  /**
   * 3. Validate Publication-Critical Fields
   */
  static validateForPublication(event) {
    const errors = [];
    if (!event.venue && !event.location) {
      errors.push('Venue/location is required before publication according to academy policy');
    }

    const todayIso = new Date().toISOString().split('T')[0];
    if (!event.event_date) {
      errors.push('Event date is required before publishing');
    } else if (DateUtils.compareDates(event.event_date, todayIso) < 0) {
      errors.push('Cannot publish an event with a date in the past');
    }

    if (event.requires_rsvp) {
      if (!event.rsvp_deadline) {
        errors.push('Response deadline is required before publishing');
      } else if (DateUtils.compareDates(event.rsvp_deadline, event.event_date) > 0) {
        errors.push('Response deadline must be on or before the event date');
      }
    }

    if (errors.length > 0) {
      const err = new Error(errors.join('; '));
      err.errors = errors;
      err.statusCode = 422;
      throw err;
    }
  }

  /**
   * 4. Publish Event & Generate Versioned Eligibility Snapshot
   */
  static publishEvent(db, academyId, eventId, actorId = null) {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status === 'published') {
      return { success: true, snapshotVersion: event.eligibility_snapshot_version || 1, message: 'Event is already published' };
    }

    // Critical Publication Validation
    this.validateForPublication(event);

    // Resolve eligible students
    let manualIds = [];
    if (event.manual_participants) {
      try {
        manualIds = typeof event.manual_participants === 'string' ? JSON.parse(event.manual_participants) : event.manual_participants;
      } catch {
        manualIds = [];
      }
    }

    let eligibleStudents = [];
    if (event.eligibility_type === 'all') {
      eligibleStudents = db.prepare("SELECT id, branch_id FROM students WHERE status = 'active' AND (academy_id IS NULL OR academy_id = ?)").all(academyId);
    } else if (manualIds.length > 0) {
      const placeholders = manualIds.map(() => '?').join(',');
      eligibleStudents = db.prepare(`SELECT id, branch_id FROM students WHERE id IN (${placeholders}) AND (academy_id IS NULL OR academy_id = ?)`).all(...manualIds, academyId);
    } else {
      eligibleStudents = db.prepare("SELECT id, branch_id FROM students WHERE status = 'active' AND (academy_id IS NULL OR academy_id = ?)").all(academyId);
    }

    if (eligibleStudents.length === 0) {
      const err = new Error('Cannot publish event: No eligible or manually selected students found');
      err.errors = ['Cannot publish event: No eligible students found'];
      err.statusCode = 422;
      throw err;
    }

    // Versioned Eligibility Snapshot in Transaction
    const applySnapshot = db.transaction(() => {
      const nextVersion = 1;

      // Update event status
      db.prepare(`
        UPDATE events
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            eligibility_snapshot_version = ?
        WHERE id = ?
      `).run(nextVersion, eventId);

      const insertParticipant = db.prepare(`
        INSERT INTO event_participants (
          event_id, student_id, branch_id, batch_id, status,
          registration_status, snapshot_version, payment_required
        ) VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)
      `);

      const updateParticipantSnapshot = db.prepare(`
        UPDATE event_participants
        SET snapshot_version = ?
        WHERE event_id = ? AND student_id = ?
      `);

      let invitedCount = 0;

      for (const student of eligibleStudents) {
        // Find student active batch
        const activeBatch = db.prepare(`
          SELECT batch_id FROM student_batch_enrollments
          WHERE student_id = ? AND status = 'active'
        `).get(student.id);

        const batchId = activeBatch ? activeBatch.batch_id : null;
        const existingParticipant = db.prepare('SELECT id, status FROM event_participants WHERE event_id = ? AND student_id = ?').get(eventId, student.id);

        if (!existingParticipant) {
          insertParticipant.run(
            eventId,
            student.id,
            student.branch_id || null,
            batchId,
            event.registration_approval_required ? 'pending' : 'not_applicable',
            nextVersion,
            event.fee > 0 ? 1 : 0
          );
          invitedCount++;
        } else {
          // Preserve existing student response status and update snapshot version
          updateParticipantSnapshot.run(nextVersion, eventId, student.id);
        }
      }

      this.recordAudit(db, academyId, 'events', eventId, 'published', {
        snapshot_version: nextVersion,
        total_eligible: eligibleStudents.length,
        newly_invited: invitedCount,
      }, actorId);

      return { nextVersion, invitedCount, totalEligible: eligibleStudents.length };
    });

    const result = applySnapshot();

    return {
      success: true,
      snapshotVersion: result.nextVersion,
      invitedCount: result.invitedCount,
      totalEligible: result.totalEligible,
      message: `Event published successfully. Invitations issued to ${result.totalEligible} eligible students (${result.invitedCount} new).`,
    };
  }

  /**
   * 5. Record Student Participation Response (Interested / Not interested)
   */
  static recordStudentResponse(db, academyId, eventId, studentId, response, notes = null, actorType = 'student', actorId = null) {
    if (!['interested', 'not_interested'].includes(response)) {
      throw new Error('Invalid response. Allowed values: interested, not_interested');
    }

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== 'published') {
      throw new Error(`Cannot respond to event in '${event.status}' status`);
    }

    // Deadline validation using server time & academy timezone
    if (event.rsvp_deadline) {
      const deadline = new Date(event.rsvp_deadline);
      const now = new Date();
      if (now > deadline) {
        throw new Error(`Response deadline has passed on ${event.rsvp_deadline}`);
      }
    }

    // Verify student is an invited participant
    const participant = db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND student_id = ?').get(eventId, studentId);
    if (!participant) {
      throw new Error('Student is not eligible or invited for this event');
    }

    const oldStatus = participant.status;
    const oldRegStatus = participant.registration_status || 'not_applicable';

    let newRegStatus = 'not_applicable';
    if (response === 'interested') {
      if (event.max_participants) {
        const confirmedCount = db.prepare(`
          SELECT COUNT(*) as c FROM event_participants
          WHERE event_id = ? AND registration_status = 'confirmed'
        `).get(eventId).c;

        if (confirmedCount >= event.max_participants) {
          newRegStatus = event.waitlist_enabled ? 'waitlisted' : 'rejected';
        } else {
          newRegStatus = event.registration_approval_required ? 'pending' : 'confirmed';
        }
      } else {
        newRegStatus = event.registration_approval_required ? 'pending' : 'confirmed';
      }
    } else {
      newRegStatus = 'rejected';
    }

    const recordTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE event_participants
        SET status = ?,
            registration_status = ?,
            responded_at = CURRENT_TIMESTAMP,
            response_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(response, newRegStatus, notes || null, participant.id);

      // Record in response history
      db.prepare(`
        INSERT INTO event_response_history (
          event_id, student_id, previous_status, new_status,
          previous_registration_status, new_registration_status,
          notes, changed_by_type, changed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        studentId,
        oldStatus,
        response,
        oldRegStatus,
        newRegStatus,
        notes || null,
        actorType,
        actorId || studentId
      );

      this.recordAudit(db, academyId, 'event_participants', participant.id, 'response_updated', {
        event_id: eventId,
        student_id: studentId,
        old_status: oldStatus,
        new_status: response,
        registration_status: newRegStatus,
      }, actorId || studentId);
    });

    recordTransaction();

    return {
      success: true,
      message: response === 'interested'
        ? (newRegStatus === 'pending'
            ? 'Interest recorded! Your registration is currently pending organizer approval.'
            : (newRegStatus === 'waitlisted'
                ? 'Interest recorded! You have been placed on the waitlist as capacity is reached.'
                : 'Interest recorded! Your registration is confirmed.'))
        : 'Your response (Not Interested) has been recorded.',
      status: response,
      response: response,
      registration_status: newRegStatus,
      registrationStatus: newRegStatus,
    };
  }

  /**
   * 6. Moderate Registration (Approve / Reject / Waitlist)
   */
  static moderateRegistration(db, academyId, eventId, participantId, newRegistrationStatus, actorId, reason = null) {
    if (newRegistrationStatus === 'approved') {
      newRegistrationStatus = 'confirmed';
    }
    if (!['confirmed', 'rejected', 'waitlisted'].includes(newRegistrationStatus)) {
      throw new Error('Invalid status. Allowed: confirmed, approved, rejected, waitlisted');
    }

    const participant = db.prepare(`
      SELECT ep.*, e.title as event_title, s.first_name, s.last_name
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
      JOIN students s ON s.id = ep.student_id
      WHERE ep.id = ? AND ep.event_id = ?
    `).get(participantId, eventId);

    if (!participant) {
      throw new Error('Participant record not found for this event');
    }

    const oldRegStatus = participant.registration_status;

    const executeModeration = db.transaction(() => {
      db.prepare(`
        UPDATE event_participants
        SET registration_status = ?,
            approved_by = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newRegistrationStatus, actorId, participantId);

      db.prepare(`
        INSERT INTO event_response_history (
          event_id, student_id, previous_status, new_status,
          previous_registration_status, new_registration_status,
          notes, changed_by_type, changed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'staff', ?)
      `).run(
        eventId,
        participant.student_id,
        participant.status,
        participant.status,
        oldRegStatus,
        newRegistrationStatus,
        reason || `Status updated to ${newRegistrationStatus} by organizer`,
        actorId
      );

      this.recordAudit(db, academyId, 'event_participants', participantId, `registration_${newRegistrationStatus}`, {
        event_id: eventId,
        student_id: participant.student_id,
        old_registration_status: oldRegStatus,
        new_registration_status: newRegistrationStatus,
        reason: reason || null,
      }, actorId);
    });

    executeModeration();

    return {
      success: true,
      registration_status: newRegistrationStatus,
      registrationStatus: newRegistrationStatus,
      message: `Participant registration ${newRegistrationStatus} successfully.`,
    };
  }

  /**
   * 7. Cancel Event
   */
  static cancelEvent(db, academyId, eventId, reason, actorId) {
    if (!reason || !reason.trim()) {
      throw new Error('Cancellation reason is required');
    }

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    db.prepare(`
      UPDATE events
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = ?
      WHERE id = ?
    `).run(reason.trim(), eventId);

    this.recordAudit(db, academyId, 'events', eventId, 'cancelled', { reason: reason.trim() }, actorId);

    return {
      success: true,
      message: 'Event cancelled successfully',
    };
  }

  /**
   * 8. Fetch Event Details & Participants Roster
   */
  static getEventWithRoster(db, academyId, eventId) {
    const event = db.prepare(`
      SELECT e.*, u.name as organizer_name
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = ?
    `).get(eventId);

    if (!event) return null;

    const participants = db.prepare(`
      SELECT ep.*, s.student_code, s.admission_number, s.first_name, s.last_name,
             TRIM(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student_name,
             s.email, s.phone, s.photo_url,
             b.name as branch_name, bt.name as batch_name,
             u.name as approver_name
      FROM event_participants ep
      JOIN students s ON s.id = ep.student_id
      LEFT JOIN branches b ON b.id = ep.branch_id
      LEFT JOIN batches bt ON bt.id = ep.batch_id
      LEFT JOIN users u ON u.id = ep.approved_by
      WHERE ep.event_id = ?
      ORDER BY ep.responded_at DESC, s.first_name ASC
    `).all(eventId);

    const stats = {
      total_invited: participants.length,
      interested: participants.filter(p => p.status === 'interested').length,
      not_interested: participants.filter(p => p.status === 'not_interested').length,
      no_response: participants.filter(p => p.status === 'invited').length,
      confirmed: participants.filter(p => p.registration_status === 'confirmed').length,
      pending_approval: participants.filter(p => p.registration_status === 'pending').length,
      waitlisted: participants.filter(p => p.registration_status === 'waitlisted').length,
      rejected: participants.filter(p => p.registration_status === 'rejected').length,
    };

    return { event, participants, stats };
  }

  /**
   * 9. Export Participant Roster to CSV
   */
  static exportRosterCsv(db, academyId, eventId) {
    const data = this.getEventWithRoster(db, academyId, eventId);
    if (!data) throw new Error('Event not found');

    const headers = [
      'Student Code',
      'Student Name',
      'Branch',
      'Batch',
      'Response Status',
      'Registration Status',
      'Responded At',
      'Snapshot Version',
      'Approved By',
    ];

    const rows = data.participants.map(p => [
      `"${p.student_code || ''}"`,
      `"${p.student_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim()}"`,
      `"${p.branch_name || ''}"`,
      `"${p.batch_name || ''}"`,
      `"${p.status}"`,
      `"${p.registration_status}"`,
      `"${p.responded_at || 'No Response'}"`,
      `"${p.snapshot_version || 1}"`,
      `"${p.approver_name || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csvContent;
  }

  /**
   * Internal audit recorder
   */
  static recordAudit(db, academyId, entityType, entityId, action, details, actorId = null) {
    try {
      db.prepare(`
        INSERT INTO audit_logs (
          user_id, action, entity, entity_id, details, ip_address
        ) VALUES (?, ?, ?, ?, ?, '127.0.0.1')
      `).run(
        actorId || null,
        `events.${action}`,
        entityType,
        String(entityId),
        typeof details === 'object' ? JSON.stringify(details) : details
      );
    } catch (e) {
      console.warn('Audit logging warning:', e.message);
    }
  }
}
