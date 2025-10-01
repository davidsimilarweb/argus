import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

export const getAllHosts = async (req: Request, res: Response) => {
  try {
    const hosts = await prisma.host.findMany({
      include: {
        currentDevices: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    sendSuccess(res, hosts);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getHostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const host = await prisma.host.findUnique({
      where: { id },
      include: {
        currentDevices: {
          include: {
            currentAccount: true
          }
        },
        deviceHistory: {
          include: {
            device: true
          },
          orderBy: {
            deployedAt: 'desc'
          }
        }
      }
    });

    if (!host) {
      return sendError(res, 'Host not found', 404);
    }

    sendSuccess(res, host);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const createHost = async (req: Request, res: Response) => {
  try {
    const { name, hostname, status, notes } = req.body;

    if (!name) {
      return sendError(res, 'Missing required field: name', 400);
    }

    const host = await prisma.host.create({
      data: {
        name,
        hostname,
        status,
        notes
      }
    });

    sendSuccess(res, host, 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const updateHost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hostname, status, notes } = req.body;

    const host = await prisma.host.update({
      where: { id },
      data: {
        hostname,
        status,
        notes
      }
    });

    sendSuccess(res, host);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const deleteHost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if host has any deployed devices
    const devicesOnHost = await prisma.device.findMany({
      where: { currentHostId: id }
    });

    if (devicesOnHost.length > 0) {
      return sendError(res, 'Cannot delete host that has deployed devices', 400);
    }

    await prisma.host.delete({
      where: { id }
    });

    sendSuccess(res, { message: 'Host deleted successfully' });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getHostDevices = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const devices = await prisma.device.findMany({
      where: { currentHostId: id },
      include: {
        currentAccount: true
      },
      orderBy: {
        deviceId: 'asc'
      }
    });

    sendSuccess(res, devices);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};