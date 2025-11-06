import { Router } from 'express';
import * as hostController from '../controllers/hosts';

const router = Router();

router.get('/', hostController.getAllHosts);
router.get('/:id', hostController.getHostById);

// Initialize slots for a host
router.post('/:id/initialize-slots', async (req, res) => {
  try {
    const { id } = req.params as any;
    const { slotCount, slotOffset } = req.body as any;
    if (typeof slotCount !== 'number' || typeof slotOffset !== 'number') {
      return res.status(400).json({ success: false, data: null, error: 'slotCount and slotOffset are required numbers' });
    }

    const host = await (await import('../utils/prisma')).default.host.update({
      where: { id },
      data: { slotCount, slotOffset },
    });

    const prisma = (await import('../utils/prisma')).default;
    let created = 0;
    for (let i = 1; i <= slotCount; i++) {
      const slotNumber = slotOffset + i;
      await prisma.inspectorSlot.upsert({
        where: { slotNumber },
        update: { hostId: id },
        create: { slotNumber, hostId: id, status: 'stopped' },
      });
      created++;
    }

    res.json({ success: true, data: { host, slotsCreated: created, slotRange: `${slotOffset + 1}-${slotOffset + slotCount}` }, error: null });
  } catch (error: any) {
    res.status(500).json({ success: false, data: null, error: error.message });
  }
});

export default router;