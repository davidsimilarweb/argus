#!/usr/bin/env python3
"""
Migrate devices from `argus_public_devices.json` into the new Argus service.

This script is intentionally similar in spirit to `migrate_accounts.py`, but:
- Uses device serial as `id` (from `internal_serial`)
- Maps legacy account UUIDs to Apple IDs using `argus_public_accounts.json`
- Supports both payload schemas:
  - new:    `status`, `account_id`
  - legacy: `current_status`, `current_account_id`

Usage examples:
  ARGUS_TOKEN=... python3 migrate_devices.py
  ARGUS_TOKEN=... python3 migrate_devices.py --dry-run --limit 10
  ARGUS_TOKEN=... python3 migrate_devices.py --schema legacy
  ARGUS_TOKEN=... python3 migrate_devices.py --base-url https://ios-sdk-server.42matters.com
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, Optional, Tuple

import requests


def _load_json(path: str) -> Any:
    with open(path, "r") as f:
        return json.load(f)


def _device_type_to_new(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    v = value.strip().lower()
    if v in ("iphone", "iPhone".lower()):
        return "iPhone"
    if v in ("ipad", "iPad".lower()):
        return "iPad"
    # If the source already has "iPhone"/"iPad" or something unexpected, keep as-is.
    return value


def _build_account_uuid_to_apple_id(accounts: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for a in accounts:
        uuid = a.get("id")
        apple_id = a.get("apple_id")
        if uuid and apple_id:
            out[str(uuid)] = str(apple_id)
    return out


def _transform_device(
    device: dict,
    account_uuid_to_apple_id: dict[str, str],
    schema: str,
) -> Tuple[Optional[str], Dict[str, Any], Optional[str]]:
    """
    Returns (serial, payload, warning).
    """
    serial = device.get("internal_serial") or device.get("id")
    serial = str(serial) if serial else None

    device_type = _device_type_to_new(device.get("device_type"))
    device_model = device.get("model")
    ios_version = device.get("ios_version")
    static_ip = device.get("static_ip")
    notes = device.get("notes")

    # Legacy source fields
    status = device.get("current_status") or device.get("status")
    account_uuid = device.get("current_account_id") or device.get("account_id")
    account_id = None
    warning = None

    if account_uuid:
        account_id = account_uuid_to_apple_id.get(str(account_uuid))
        if account_id is None:
            warning = f"account uuid not found in accounts export: {account_uuid}"

    extra_data: Dict[str, Any] = {
        "legacy": {
            "device_uuid": device.get("id"),
            "device_id": device.get("device_id"),
            "current_host_id": device.get("current_host_id"),
            "created_at": device.get("created_at"),
            "updated_at": device.get("updated_at"),
        }
    }

    # Drop null-ish values from extra_data. Keep structure stable.
    extra_data["legacy"] = {k: v for k, v in extra_data["legacy"].items() if v is not None}

    if schema == "legacy":
        payload: Dict[str, Any] = {
            "id": serial,
            "device_type": device_type,
            "device_model": device_model,
            "ios_version": ios_version,
            "static_ip": static_ip,
            "current_status": status,
            "current_account_id": account_id,
            "notes": notes,
            "extra_data": extra_data if extra_data["legacy"] else None,
        }
    else:
        payload = {
            "id": serial,
            "device_type": device_type,
            "device_model": device_model,
            "ios_version": ios_version,
            "static_ip": static_ip,
            "status": status,
            "account_id": account_id,
            "notes": notes,
            "extra_data": extra_data if extra_data["legacy"] else None,
        }

    # Remove keys with value == None, except allow explicit null unassign for account
    # (and keep status even if missing so server can reject clearly).
    cleaned: Dict[str, Any] = {"id": payload["id"]}
    for k, v in payload.items():
        if k == "id":
            continue
        if k in ("account_id", "current_account_id"):
            cleaned[k] = v  # keep null (unassign)
            continue
        if v is not None:
            cleaned[k] = v

    return serial, cleaned, warning


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate Argus devices into new service.")
    parser.add_argument("--devices", default="argus_public_devices.json", help="Path to devices JSON export")
    parser.add_argument("--accounts", default="argus_public_accounts.json", help="Path to accounts JSON export")
    parser.add_argument("--base-url", default=os.environ.get("ARGUS_BASE_URL", "https://ios-sdk-server-staging.42matters.com"))
    parser.add_argument("--token", default=os.environ.get("ARGUS_TOKEN"))
    parser.add_argument("--schema", choices=("new", "legacy"), default="new", help="Payload schema to use")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent, don’t call API")
    parser.add_argument("--limit", type=int, default=0, help="Stop after N devices (0 = no limit)")
    parser.add_argument("--sleep", type=float, default=0.1, help="Delay between requests (seconds)")
    parser.add_argument("--upsert", action="store_true", help="If POST fails because it exists, try PUT")
    args = parser.parse_args()

    if not args.token and not args.dry_run:
        print("ERROR: missing token. Set ARGUS_TOKEN or pass --token.", file=sys.stderr)
        return 2

    devices = _load_json(args.devices)
    accounts = _load_json(args.accounts)
    if not isinstance(devices, list) or not isinstance(accounts, list):
        print("ERROR: JSON files must contain top-level arrays.", file=sys.stderr)
        return 2

    account_uuid_to_apple_id = _build_account_uuid_to_apple_id(accounts)

    api_url = args.base_url.rstrip("/") + "/argus/devices"
    headers = {
        "X-Token": args.token or "",
        "Content-Type": "application/json",
    }

    success = 0
    skipped = 0
    warned = 0
    errors = 0

    for idx, d in enumerate(devices):
        if args.limit and idx >= args.limit:
            break

        if not isinstance(d, dict):
            print(f"SKIP: non-object entry at index {idx}")
            skipped += 1
            continue

        serial, payload, warning = _transform_device(d, account_uuid_to_apple_id, args.schema)
        if not serial:
            print(f"SKIP: missing internal_serial for index {idx}")
            skipped += 1
            continue

        if warning:
            print(f"WARN: {serial} - {warning}")
            warned += 1

        if args.dry_run:
            print(f"DRYRUN: {serial} -> {json.dumps(payload, ensure_ascii=False)}")
            success += 1
            continue

        try:
            r = requests.post(api_url, headers=headers, json=payload, timeout=30)
            if r.status_code in (200, 201):
                print(f"OK: {serial}")
                success += 1
            else:
                # If it exists, optionally upsert via PUT.
                if args.upsert and r.status_code in (409, 422, 400):
                    update_payload = dict(payload)
                    update_payload.pop("id", None)
                    put_url = f"{api_url}/{serial}"
                    r2 = requests.put(put_url, headers=headers, json=update_payload, timeout=30)
                    if r2.status_code in (200, 201):
                        print(f"OK (PUT): {serial}")
                        success += 1
                    else:
                        print(f"ERROR: {serial} - POST {r.status_code}: {r.text} | PUT {r2.status_code}: {r2.text}")
                        errors += 1
                else:
                    print(f"ERROR: {serial} - {r.status_code}: {r.text}")
                    errors += 1
        except Exception as e:
            print(f"ERROR: {serial} - {e}")
            errors += 1

        time.sleep(max(args.sleep, 0.0))

    print(f"\nDone. Success: {success}, Skipped: {skipped}, Warned: {warned}, Errors: {errors}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

