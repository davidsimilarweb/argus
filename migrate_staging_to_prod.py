#!/usr/bin/env python3
"""
Migrate Argus data from staging -> prod (accounts + devices).

Flow:
  1) GET accounts + devices from staging (source)
  2) POST into prod (destination), optionally fallback to PUT (upsert)

Tokens are NOT hardcoded; use env vars or CLI flags.

Examples:
  STAGING_TOKEN=... PROD_TOKEN=... python3 migrate_staging_to_prod.py --dry-run --limit 5
  STAGING_TOKEN=... PROD_TOKEN=... python3 migrate_staging_to_prod.py --upsert
  STAGING_TOKEN=... PROD_TOKEN=... python3 migrate_staging_to_prod.py --schema legacy --upsert
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, Optional

import requests


def _headers(token: str) -> dict[str, str]:
    return {
        "X-Token": token,
        "Content-Type": "application/json",
    }


def _device_type_to_new(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip().lower()
    if v == "iphone":
        return "iPhone"
    if v == "ipad":
        return "iPad"
    return str(value)


def _fetch_json(url: str, token: str) -> Any:
    r = requests.get(url, headers=_headers(token), timeout=60)
    r.raise_for_status()
    return r.json()


def _normalize_account(raw: dict[str, Any]) -> dict[str, Any]:
    # Staging returns DB-ish fields too; only send what API accepts.
    return {
        "id": raw.get("id"),
        "country": raw.get("country"),
        "password": raw.get("password"),
        "two_factor": raw.get("two_factor"),
        "notes": raw.get("notes"),
    }


def _normalize_device(raw: dict[str, Any], schema: str) -> dict[str, Any]:
    account_id = raw.get("account_id")
    if account_id is None:
        account = raw.get("account") or {}
        if isinstance(account, dict):
            account_id = account.get("id")

    base: Dict[str, Any] = {
        "id": raw.get("id"),
        "device_type": _device_type_to_new(raw.get("device_type")),
        "device_model": raw.get("device_model"),
        "ios_version": raw.get("ios_version"),
        "static_ip": raw.get("static_ip"),
        "notes": raw.get("notes"),
        "extra_data": raw.get("extra_data"),
    }

    if schema == "legacy":
        base["current_status"] = raw.get("status") or raw.get("current_status")
        base["current_account_id"] = account_id
    else:
        base["status"] = raw.get("status") or raw.get("current_status")
        base["account_id"] = account_id

    # Remove keys that are None, but keep explicit null for account assignment.
    cleaned: Dict[str, Any] = {"id": base["id"]}
    for k, v in base.items():
        if k == "id":
            continue
        if k in ("account_id", "current_account_id"):
            cleaned[k] = v
            continue
        if v is not None:
            cleaned[k] = v
    return cleaned


def _post_or_put(
    *,
    kind: str,
    base_url: str,
    token: str,
    obj_id: str,
    payload: dict[str, Any],
    upsert: bool,
    dry_run: bool,
) -> bool:
    """
    Returns True on success.
    """
    collection_url = f"{base_url.rstrip('/')}/argus/{kind}"
    item_url = f"{collection_url}/{obj_id}"

    if dry_run:
        print(f"DRYRUN {kind} POST {collection_url} -> {json.dumps(payload, ensure_ascii=False)}")
        return True

    r = requests.post(collection_url, headers=_headers(token), json=payload, timeout=60)
    if r.status_code in (200, 201):
        print(f"OK {kind}: {obj_id}")
        return True

    if not upsert:
        print(f"ERROR {kind}: {obj_id} - POST {r.status_code}: {r.text}")
        return False

    update_payload = dict(payload)
    update_payload.pop("id", None)
    r2 = requests.put(item_url, headers=_headers(token), json=update_payload, timeout=60)
    if r2.status_code in (200, 201):
        print(f"OK {kind} (PUT): {obj_id}")
        return True

    print(f"ERROR {kind}: {obj_id} - POST {r.status_code}: {r.text} | PUT {r2.status_code}: {r2.text}")
    return False


def main() -> int:
    p = argparse.ArgumentParser(description="Migrate Argus staging -> prod (accounts + devices).")
    p.add_argument("--staging-base-url", default=os.environ.get("STAGING_BASE_URL", "https://ios-sdk-server-staging.42matters.com"))
    p.add_argument("--prod-base-url", default=os.environ.get("PROD_BASE_URL", "https://ios-sdk-server.42matters.com"))
    p.add_argument("--staging-token", default=os.environ.get("STAGING_TOKEN"))
    p.add_argument("--prod-token", default=os.environ.get("PROD_TOKEN"))
    p.add_argument("--schema", choices=("new", "legacy"), default="new", help="Device payload schema")
    p.add_argument("--dry-run", action="store_true", help="Fetch from staging but don't write to prod")
    p.add_argument("--upsert", action="store_true", help="If POST fails, try PUT")
    p.add_argument("--limit", type=int, default=0, help="Stop after N items per kind (0 = no limit)")
    p.add_argument("--sleep", type=float, default=0.1, help="Delay between prod writes (seconds)")
    args = p.parse_args()

    if not args.staging_token:
        print("ERROR: missing staging token. Set STAGING_TOKEN or pass --staging-token.", file=sys.stderr)
        return 2
    if not args.prod_token and not args.dry_run:
        print("ERROR: missing prod token. Set PROD_TOKEN or pass --prod-token.", file=sys.stderr)
        return 2

    staging_accounts_url = f"{args.staging_base_url.rstrip('/')}/argus/accounts"
    staging_devices_url = f"{args.staging_base_url.rstrip('/')}/argus/devices"

    print(f"Fetching accounts from staging: {staging_accounts_url}")
    accounts = _fetch_json(staging_accounts_url, args.staging_token)
    if not isinstance(accounts, list):
        print("ERROR: staging /accounts did not return a list.", file=sys.stderr)
        return 2

    print(f"Fetching devices from staging: {staging_devices_url}")
    devices = _fetch_json(staging_devices_url, args.staging_token)
    if not isinstance(devices, list):
        print("ERROR: staging /devices did not return a list.", file=sys.stderr)
        return 2

    # 1) Accounts first (so devices can reference account_id that already exists)
    ok = 0
    err = 0
    for i, a in enumerate(accounts):
        if args.limit and i >= args.limit:
            break
        if not isinstance(a, dict):
            continue
        payload = _normalize_account(a)
        account_id = payload.get("id")
        if not account_id:
            print("SKIP account: missing id")
            continue
        if _post_or_put(
            kind="accounts",
            base_url=args.prod_base_url,
            token=args.prod_token or "",
            obj_id=str(account_id),
            payload=payload,
            upsert=args.upsert,
            dry_run=args.dry_run,
        ):
            ok += 1
        else:
            err += 1
        time.sleep(max(args.sleep, 0.0))

    print(f"\nAccounts done. OK: {ok}, Errors: {err}\n")

    # 2) Devices
    ok_d = 0
    err_d = 0
    for i, d in enumerate(devices):
        if args.limit and i >= args.limit:
            break
        if not isinstance(d, dict):
            continue
        payload = _normalize_device(d, args.schema)
        device_id = payload.get("id")
        if not device_id:
            print("SKIP device: missing id")
            continue
        if _post_or_put(
            kind="devices",
            base_url=args.prod_base_url,
            token=args.prod_token or "",
            obj_id=str(device_id),
            payload=payload,
            upsert=args.upsert,
            dry_run=args.dry_run,
        ):
            ok_d += 1
        else:
            err_d += 1
        time.sleep(max(args.sleep, 0.0))

    print(f"\nDevices done. OK: {ok_d}, Errors: {err_d}")
    return 0 if (err == 0 and err_d == 0) else 1


if __name__ == "__main__":
    raise SystemExit(main())

