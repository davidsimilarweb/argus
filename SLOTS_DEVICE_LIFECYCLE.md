# Device Lifecycle vs Inspector Slots - Proposal

Last updated: 2025-11-06

## Goals
- Allow plugging devices into hosts and starting iOS Inspector without static host-bound configs.
- Keep monitoring slot-centric; preserve health history per slot across device swaps.
- Maintain physical traceability so a technician can find the right phone fast.

## Identity & Naming
- Devices are named ARG-### on the device itself; this maps to `Device.internalSerial` (canonical identity).
- We do not persist UDID; the agent maps UDID→name locally and uses the name (ARG-###) to match.

## Assignment & Agent Flow (manual, traceable)
- Operators assign a device (by `internalSerial`) to a slot (one-to-one) in Argus.
- The iOS Inspector agent on each host:
  1) Lists connected devices (UDID→name locally; name should be ARG-###).
  2) Fetches data it needs from existing endpoints: `/api/devices` and `/api/slots?hostId=<HOST_ID>`.
  3) For each slot on that host:
     - If the assigned device’s ARG-### is connected → start inspector for that slot.
     - If assigned device is not connected → report “missing”.
  4) Any connected device that doesn’t match an assigned slot on this host is “unexpected”.
- Overwrite flow: operator can quickly reassign a slot to another device; Argus will unassign the previous device and assign the new one in a single action.
- No separate config endpoint is required.

## Data Model Implications
- Remove `Device.deviceId` entirely (legacy mapping to slot number). Slots replace this concept.
- Use a single assignment field on the slot:
  - `InspectorSlot.currentDevice` (represents the assigned device for that slot).
- Track assignment history:
  - `SlotDeviceHistory` records when a device is assigned/unassigned to a slot (never delete; always close with `unassignedAt`).
- Health checks reference slots:
  - `HealthCheck.slotId` (slot-centric). `HealthCheck.metadata` stores extra debugging info.

## Static IPs
- `Device.staticIp` is unique. IPs are managed manually on devices.
- `NetworkReservation` tracks additional (external) reserved IPs to avoid conflicts and present a complete view of the network.
- UI provides an “IPs” page listing device IPs, reservations, and conflicts.

## Edge Cases
- Multiple connected devices, fewer available slots: UI offers an overwrite action to replace the assigned device for a slot.
- Device moved between hosts: assignment is changed explicitly by operator; `SlotDeviceHistory` always preserves full history (we never delete).
- No mapping to physical USB ports; technicians rely on the Slots UI, mapped to phisical slot stickers(We define ex: ARG-123 to slot 1, so the technician puts it on the phisical slot with the sticket 1, so when a health check fails for slot 1, he know where to check the device) and device labels (ARG-###).


## Open Notes
- We rely on ARG-### naming as the bridge between the agent’s local enumeration and Argus’s device records.
- IPs remain operator-managed; assignment does not mutate device IPs automatically.

## Rollout Plan
1) Remove `Device.deviceId` from schema and code paths (after UI moves to slots).
2) Ensure slot assignment UI (set/replace device for slot) and history are in place.
3) Agent integration: enumerate devices, fetch `/api/devices` + `/api/slots?hostId=...`, perform presence checks, start/skip per slot.
4) Slot-centric health stays; metadata-only payload supported.
