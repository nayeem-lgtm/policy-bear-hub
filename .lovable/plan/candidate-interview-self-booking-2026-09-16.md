# Candidate Interview Self-Booking

## Goal
Replace the single fixed interview date field with a PolicyBear booking flow. An admin opens specific date/time ranges for one candidate, shares a secure link, and the candidate chooses an available interview slot.

## Admin experience
- Rebuild the Interview Scheduling card around two modes: **Candidate self-books** and **Schedule manually**.
- Add date-range availability with a calendar, start/end times, interview length, timezone, custom meeting link, and internal notes.
- Show generated slots, booked status, and controls to copy, regenerate, or disable the candidate’s booking link.
- Preserve rescheduling, completion, email automation, and the existing onboarding stage progression.

## Candidate experience
- Add a public, branded booking page opened by a secure candidate-specific link.
- Show only that candidate’s active available dates and unbooked time slots.
- Let the candidate select a date, choose one slot, review the interview details, and confirm.
- Show a clear confirmation screen with the custom meeting link and selected local time.

## Data and safeguards
- Add an interview availability table for candidate, date range, daily start/end times, slot duration, timezone, meeting link, active status, and booking token.
- Add a bookings table to reserve one slot and prevent double-booking.
- Keep full candidate records private. The public page receives only the candidate’s first name and booking information through narrowly scoped server endpoints.
- Confirm bookings atomically so two people cannot reserve the same slot.
- Record link creation, booking, rescheduling, and cancellation in onboarding events.

## Integration
- A confirmed choice updates the candidate’s existing interview date, duration, and custom meeting link.
- Existing interview invitation/reminder/follow-up emails continue using the confirmed time and link.
- The existing manual scheduling option remains available for administrators.

## Verification
- Test admin range creation and slot generation.
- Test the public booking link without login.
- Test booking confirmation, duplicate-slot protection, candidate record updates, and the onboarding timeline.
- Check the admin and candidate pages on desktop and mobile widths.
