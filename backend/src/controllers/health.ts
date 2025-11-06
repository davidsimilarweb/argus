import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

const mapIncomingStatus = (status: string) => {
  if (status === 'ok') return 'healthy';
  if (status === 'warning' || status === 'error' || status === 'healthy') return status;
  return 'healthy';
};

export const postHealthBySlotNumber = async (req: Request, res: Response) => {
  try {
    const { slotNumber } = req.params as any;
    const { status, errorMessage, metadata } = req.body;

    const slot = await prisma.inspectorSlot.findUnique({ where: { slotNumber: Number(slotNumber) } });
    if (!slot) return sendError(res, 'Slot not found', 404);

    const normalized = mapIncomingStatus(status);

    await prisma.healthCheck.create({
      data: {
        slotId: slot.id,
        status: normalized as any,
        errorMessage,
        metadata: metadata ?? null,
      },
    });

    const slotStatus = normalized === 'healthy' ? 'active' : normalized;
    await prisma.inspectorSlot.update({
      where: { id: slot.id },
      data: {
        lastHealthCheck: new Date(),
        status: slotStatus as any,
        lastErrorMessage: errorMessage || null,
      },
    });

    sendSuccess(res, { slotNumber: Number(slotNumber), acknowledged: true, currentStatus: slotStatus });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getHealthHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100', status, startDate, endDate } = req.query as Record<string, string>;

    const where: any = { slotId: id };
    if (status) where.status = status;
    if (startDate) where.checkedAt = { ...(where.checkedAt || {}), gte: new Date(startDate) };
    if (endDate) where.checkedAt = { ...(where.checkedAt || {}), lte: new Date(endDate) };

    const history = await prisma.healthCheck.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      take: Number(limit),
    });

    sendSuccess(res, history);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getHealthSummary = async (_req: Request, res: Response) => {
  try {
    const slots = await prisma.inspectorSlot.findMany({ include: { host: true } });

    const summary = {
      totalSlots: slots.length,
      activeSlots: slots.filter(s => s.status === 'active').length,
      warningSlots: slots.filter(s => s.status === 'warning').length,
      errorSlots: slots.filter(s => s.status === 'error').length,
      stoppedSlots: slots.filter(s => s.status === 'stopped').length,
      timeoutSlots: slots.filter(s => s.status === 'timeout').length,
      byHost: {} as Record<string, any>,
      recentErrors: [] as any[],
    };

    for (const slot of slots) {
      const hostName = slot.host?.name || 'unknown';
      summary.byHost[hostName] ||= { total: 0, active: 0, warning: 0, error: 0, stopped: 0, timeout: 0 };
      summary.byHost[hostName].total++;
      (summary.byHost[hostName] as any)[slot.status]++;
    }

    const recent = await prisma.healthCheck.findMany({
      where: { status: { in: ['warning', 'error'] } },
      orderBy: { checkedAt: 'desc' },
      take: 25,
    });

    for (const hc of recent) {
      const slot = slots.find(s => s.id === hc.slotId);
      if (!slot) continue;
      summary.recentErrors.push({
        slotNumber: slot.slotNumber,
        slotId: slot.id,
        errorMessage: hc.errorMessage,
        errorType: (hc.metadata as any)?.errorType,
        occurredAt: hc.checkedAt,
      });
    }

    sendSuccess(res, summary);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
