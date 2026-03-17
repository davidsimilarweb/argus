#!/usr/bin/env python3
import json
import requests
import sys
import time

API_URL = "https://ios-sdk-server-staging.42matters.com/argus/accounts"
API_TOKEN = "Dv8TQFKsqjJqb227ZGvEl13E3pvWCyIIHYcQmaC9PwggfaUOHukKxWx54RCZPciM"

def migrate_accounts(json_file: str):
    with open(json_file, "r") as f:
        accounts = json.load(f)

    headers = {
        "X-Token": API_TOKEN,
        "Content-Type": "application/json"
    }

    success_count = 0
    error_count = 0

    for account in accounts:
        # Skip accounts without required fields
        if not account.get("apple_id") or not account.get("password"):
            print(f"SKIP: {account.get('apple_id', 'unknown')} - missing apple_id or password")
            error_count += 1
            continue

        # Transform to staging schema
        payload = {
            "id": account["apple_id"],
            "country": account.get("country") or "US",
            "password": account["password"],
            "two_factor": account.get("two_factor") or "",
            "notes": account.get("notes") or ""
        }

        try:
            response = requests.post(API_URL, headers=headers, json=payload)
            if response.status_code in (200, 201):
                print(f"OK: {payload['id']}")
                success_count += 1
            else:
                print(f"ERROR: {payload['id']} - {response.status_code}: {response.text}")
                error_count += 1
        except Exception as e:
            print(f"ERROR: {payload['id']} - {e}")
            error_count += 1

        time.sleep(0.1)  # Small delay to avoid rate limiting

    print(f"\nDone. Success: {success_count}, Errors: {error_count}")

if __name__ == "__main__":
    json_file = sys.argv[1] if len(sys.argv) > 1 else "argus_public_accounts.json"
    migrate_accounts(json_file)
