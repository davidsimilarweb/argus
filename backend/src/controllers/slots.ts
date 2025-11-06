import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

export const listSlots = async (req: Request, res: Response) => {
  try {
    const { hostId, status } = req.query as { hostId?: string; status?: string };
    const where: any = {};
    if (hostId) where.hostId = hostId;
    if (status) where.status = status;

    const slots = await prisma.inspectorSlot.findMany({
      where,
      include: {
        host: true,
        currentDevice: {
          include: {
            currentAccount: true,
          },
        },
      },
      orderBy: { slotNumber: 'asc' },
    });
    sendSuccess(res, slots);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getSlotById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const slot = await prisma.inspectorSlot.findUnique({
      where: { id },
      include: {
        host: true,
        currentDevice: {
          include: { currentAccount: true },
        },
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 50,
        },
        slotHistory: {
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!slot) return sendError(res, 'Slot not found', 404);
    sendSuccess(res, slot);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const assignDevice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deviceId, notes } = req.body as { deviceId: string; notes?: string };
    if (!deviceId) return sendError(res, 'Missing required field: deviceId', 400);

    const [slot, device] = await Promise.all([
      prisma.inspectorSlot.findUnique({ where: { id } }),
      prisma.device.findUnique({ where: { id: deviceId } }),
    ]);
    if (!slot) return sendError(res, 'Slot not found', 404);
    if (!device) return sendError(res, 'Device not found', 404);

    // Ensure device not already in another slot
    const existingSlotForDevice = await prisma.inspectorSlot.findFirst({ where: { currentDeviceId: deviceId } });
    if (existingSlotForDevice && existingSlotForDevice.id !== id) {
      return sendError(res, 'Device already assigned to another slot', 400);
    }

    // Unassign previous device in this slot if any
    let previousDeviceId: string | null = slot.currentDeviceId || null;
    if (previousDeviceId) {
      await prisma.slotDeviceHistory.updateMany({
        where: { slotId: slot.id, deviceId: previousDeviceId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
    }

    const updatedSlot = await prisma.inspectorSlot.update({
      where: { id: slot.id },
      data: {
        currentDeviceId: deviceId,
        status: device.currentStatus === 'deployed' ? 'active' : 'stopped',
      },
    });

    await prisma.slotDeviceHistory.create({
      data: { slotId: slot.id, deviceId, notes },
    });

    sendSuccess(res, { slot: updatedSlot, previousDeviceId, newDeviceId: deviceId });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const unassignDevice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body as { notes?: string };

    const slot = await prisma.inspectorSlot.findUnique({ where: { id } });
    if (!slot) return sendError(res, 'Slot not found', 404);

    const previousDeviceId = slot.currentDeviceId;

    const updatedSlot = await prisma.inspectorSlot.update({
      where: { id: slot.id },
      data: { currentDeviceId: null, status: 'stopped' },
    });

    if (previousDeviceId) {
      await prisma.slotDeviceHistory.updateMany({
        where: { slotId: slot.id, deviceId: previousDeviceId, unassignedAt: null },
        data: { unassignedAt: new Date(), notes },
      });
    }

    sendSuccess(res, { slot: updatedSlot, unassignedDeviceId: previousDeviceId });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const updateSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body as { status?: 'active' | 'warning' | 'error' | 'stopped' | 'timeout'; notes?: string };

    const updated = await prisma.inspectorSlot.update({
      where: { id },
      data: { status, notes },
    });
    sendSuccess(res, updated);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const startSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.inspectorSlot.update({ where: { id }, data: { status: 'active' } });
    sendSuccess(res, { message: 'Slot started successfully', slot: updated });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const stopSlot = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await prisma.inspectorSlot.update({ where: { id }, data: { status: 'stopped' } });
    sendSuccess(res, { message: 'Slot stopped successfully', slot: updated });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
