import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

export const listReservations = async (_req: Request, res: Response) => {
  try {
    const reservations = await prisma.networkReservation.findMany({
      orderBy: { ip: 'asc' },
      include: { reservedDevice: true },
    });
    sendSuccess(res, reservations);
  } catch (e: any) {
    sendError(res, e.message, 500);
  }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const { ip, type, label, reservedDeviceId, notes } = req.body;
    if (!ip) return sendError(res, 'Missing required field: ip', 400);
    const created = await prisma.networkReservation.create({
      data: { ip, type, label, reservedDeviceId, notes },
    });
    sendSuccess(res, created, 201);
  } catch (e: any) {
    sendError(res, e.message, 500);
  }
};

export const updateReservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, label, reservedDeviceId, notes } = req.body;
    const updated = await prisma.networkReservation.update({
      where: { id },
      data: { type, label, reservedDeviceId, notes },
    });
    sendSuccess(res, updated);
  } catch (e: any) {
    sendError(res, e.message, 500);
  }
};

export const deleteReservation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.networkReservation.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  } catch (e: any) {
    sendError(res, e.message, 500);
  }
};

export const getSummary = async (_req: Request, res: Response) => {
  try {
    const [reservations, devices] = await Promise.all([
      prisma.networkReservation.findMany(),
      prisma.device.findMany({ select: { id: true, internalSerial: true, staticIp: true } }),
    ]);

    const conflicts: Array<{ ip: string; sources: string[] }> = [];
    const ipToSources: Record<string, string[]> = {};

    for (const d of devices) {
      if (!d.staticIp) continue;
      ipToSources[d.staticIp] ||= [];
      ipToSources[d.staticIp].push(`device:${d.internalSerial}`);
    }
    for (const r of reservations) {
      ipToSources[r.ip] ||= [];
      ipToSources[r.ip].push(r.label ? `reservation:${r.label}` : `reservation:${r.id}`);
    }

    for (const [ip, sources] of Object.entries(ipToSources)) {
      if (sources.length > 1) conflicts.push({ ip, sources });
    }

    sendSuccess(res, { totalReservations: reservations.length, totalDevices: devices.length, conflicts });
  } catch (e: any) {
    sendError(res, e.message, 500);
  }
};
