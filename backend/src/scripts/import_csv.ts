import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const CSV_PATH = path.resolve(process.cwd(), 'migration/iphones.csv');

interface CsvRow {
  phoneId: string;
  email: string;
  password: string;
  iosVersion: string;
  twoFactor: string;
  itunesEmail: string;
  country: string;
}

function normalizeCountry(country: string | undefined): string | undefined {
  if (!country) return undefined;
  const c = country.trim();
  return c.length ? c : undefined;
}

async function upsertAccount(email: string, password: string | undefined, twoFactor: string | undefined, country: string | undefined) {
  // Check existing accounts by listing all and finding by appleId to keep API simple
  const list = await axios.get(`${API_BASE}/api/accounts`);
  const existing = (list.data?.data || []).find((a: any) => a.appleId === email);
  if (existing) {
    if (password || twoFactor || country) {
      await axios.patch(`${API_BASE}/api/accounts/${existing.id}`, { password, twoFactor, country });
    }
    return existing.id as string;
  }
  const created = await axios.post(`${API_BASE}/api/accounts`, {
    appleId: email,
    password: password || undefined,
    twoFactor: twoFactor || undefined,
    country: normalizeCountry(country),
  });
  return created.data.data.id as string;
}

async function createDevice(deviceId: number, iosVersion: string | undefined) {
  const payload = {
    internalSerial: `ARG-${deviceId.toString().padStart(3, '0')}`,
    deviceId,
    deviceType: 'iphone',
    iosVersion: iosVersion || undefined,
  };
  const res = await axios.post(`${API_BASE}/api/devices`, payload);
  return res.data.data.id as string;
}

async function assignDeviceToAccount(deviceId: string, accountId: string) {
  await axios.post(`${API_BASE}/api/devices/${deviceId}/assign-account`, { accountId });
}

async function main() {
  console.log(`Reading CSV from ${CSV_PATH}`);
  const parser = fs
    .createReadStream(CSV_PATH)
    .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

  let processed = 0;
  for await (const record of parser) {
    const row: CsvRow = {
      phoneId: record['Phone ID'] || record['PhoneID'] || record['ID'] || '',
      email: (record['Email for Apple ID (to activate phone)'] || record['Email'] || '').trim(),
      password: (record['Password'] || '').trim(),
      iosVersion: (record['iOS Version'] || '').trim(),
      twoFactor: (record['2 Factor Auth'] || record['2FA'] || '').trim(),
      itunesEmail: (record['Email for iTunes'] || '').trim(),
      country: (record['Country'] || '').trim(),
    };

    if (!row.phoneId || !row.email) {
      console.log(`Skipping row missing phoneId or email:`, record);
      continue;
    }

    const deviceNumber = parseInt(row.phoneId, 10);
    if (Number.isNaN(deviceNumber)) {
      console.log(`Skipping invalid phoneId: ${row.phoneId}`);
      continue;
    }

    try {
      const accountId = await upsertAccount(row.email, row.password || undefined, row.twoFactor || undefined, row.country || undefined);
      const deviceId = await createDevice(deviceNumber, row.iosVersion || undefined);
      await assignDeviceToAccount(deviceId, accountId);
      processed += 1;
      if (processed % 10 === 0) console.log(`Processed ${processed} rows...`);
    } catch (err: any) {
      console.error(`Error processing row for device ${row.phoneId} / ${row.email}:`, err.response?.data || err.message);
    }
  }

  console.log(`Done. Processed ${processed} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


