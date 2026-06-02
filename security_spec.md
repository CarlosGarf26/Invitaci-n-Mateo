# Security Specification for Operational Crew Database

This document details the Zero-Trust security rules designed to protect Captain Mateo's RSVP Database in Cloud Firestore.

## 1. Data Invariants
- Any civilian or pilot friend can create an RSVP on the public invitation link without requiring an account.
- Since guests do not log in, writes are publicly permissible ONLY if they satisfy rigorous schema validation.
- The default family pilots (Mateo, Mother, Father) are protected "Immortal" or "System" records that cannot be modified or deleted by anyone via the public API.
- All IDs must match alphanumeric identifiers to block ID poisoning/injection.

## 2. The "Dirty Dozen" Malicious Payloads
1. **Invalid ID Attack**: Create RSVP with ID containing bad characters `crew/$$$invalid-id$$$`.
2. **Name Bloat Attack**: Create RSVP where name exceeds 100 characters.
3. **Invalid Status**: Create RSVP with status set to `'attacker'`.
4. **Invalid Copilots (Negative)**: Create RSVP with copilots set to `-5`.
5. **Invalid Copilots (Huge)**: Create RSVP with copilots set to `999`.
6. **Shadow Field Injection**: Inject extra key `role: 'admin'`.
7. **System Record Modification (Mateo)**: Attempt to overwrite official record `crew/1` with new name.
8. **System Record Modification (Mom)**: Attempt to overwrite official record `crew/2`.
9. **System Record Modification (Dad)**: Attempt to overwrite official record `crew/3`.
10. **System Record Deletion**: Attempt to delete the founder records `crew/1`, `crew/2` or `crew/3`.
11. **Massive Payload Storage**: Inject binary or extremely long fake properties.
12. **Tampering with ID Reference**: Match code where `id` in path is different than `id` field inside payload.

## 3. Test Runner Schema Verification
All of the scenarios listed above return `PERMISSION_DENIED`. Under no circumstance can clients alter structural parameters of Mateo's roster.
