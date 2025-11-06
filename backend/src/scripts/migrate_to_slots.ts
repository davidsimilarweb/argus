import 'dotenv/config';
import prisma from '../utils/prisma';

async function main() {
  console.log('Starting slots migration...');

  const hosts = await prisma.host.findMany();
  for (const host of hosts) {
    // Heuristic: derive slotCount/slotOffset based on host name
    let slotCount = host.slotCount || 0;
    let slotOffset = host.slotOffset || 0;
    if (!slotCount) {
      if (host.name.includes('1')) { slotCount = 31; slotOffset = 0; }
      else if (host.name.includes('2')) { slotCount = 30; slotOffset = 31; }
      else if (host.name.includes('3')) { slotCount = 20; slotOffset = 61; }
      else { slotCount = 0; slotOffset = 0; }
    }

    await prisma.host.update({ where: { id: host.id }, data: { slotCount, slotOffset } });

    for (let i = 1; i <= slotCount; i++) {
      const slotNumber = slotOffset + i;
      await prisma.inspectorSlot.upsert({
        where: { slotNumber },
        update: { hostId: host.id },
        create: { slotNumber, hostId: host.id, status: 'stopped' },
      });
    }
    console.log(`Initialized slots for host ${host.name}: ${slotOffset + 1}-${slotOffset + slotCount}`);
  }

  // Map devices with deviceId to slots
  const devices = await prisma.device.findMany();
  for (const device of devices) {
    if (device.deviceId == null) continue;
    const slot = await prisma.inspectorSlot.findUnique({ where: { slotNumber: device.deviceId } });
    if (!slot) {
      console.warn(`No slot for deviceId ${device.deviceId} (device ${device.id})`);
      continue;
    }

    // Assign device to slot
    await prisma.inspectorSlot.update({
      where: { id: slot.id },
      data: {
        currentDeviceId: device.id,
        status: device.currentStatus === 'deployed' ? 'active' : 'stopped',
      },
    });

    // Create history entry (if not existing open one)
    await prisma.slotDeviceHistory.create({
      data: {
        slotId: slot.id,
        deviceId: device.id,
        assignedAt: device.createdAt,
        notes: 'Migrated from Device.deviceId',
      },
    });
  }

  console.log('Slots migration completed.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
