import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

export const getAllDevices = async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        currentHost: true,
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

export const getDeviceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        currentHost: true,
        currentAccount: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' }
        },
        accountHistory: {
          include: { account: true },
          orderBy: { assignedAt: 'desc' }
        },
        hostHistory: {
          include: { host: true },
          orderBy: { deployedAt: 'desc' }
        },
        maintenanceEvents: {
          orderBy: { performedAt: 'desc' }
        },
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    sendSuccess(res, device);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const createDevice = async (req: Request, res: Response) => {
  try {
    const { internalSerial, deviceId, staticIp, deviceType, model, iosVersion, notes } = req.body;

    if (!internalSerial || !deviceType) {
      return sendError(res, 'Missing required fields: internalSerial, deviceType', 400);
    }

    const device = await prisma.device.create({
      data: {
        internalSerial,
        deviceId: deviceId ? parseInt(deviceId, 10) : null,
        staticIp,
        deviceType,
        model,
        iosVersion,
        notes
      }
    });

    // Create initial status history
    await prisma.deviceStatusHistory.create({
      data: {
        deviceId: device.id,
        status: device.currentStatus,
        notes: 'Device created'
      }
    });

    sendSuccess(res, device, 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const updateDevice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { internalSerial, deviceId, deviceType, staticIp, model, iosVersion, notes } = req.body;

    const device = await prisma.device.update({
      where: { id },
      data: {
        internalSerial,
        deviceType,
        staticIp,
        model,
        iosVersion,
        notes,
        deviceId: deviceId === null
          ? null
          : typeof deviceId === 'number'
            ? deviceId
            : deviceId
              ? parseInt(deviceId, 10)
              : undefined
      }
    });

    sendSuccess(res, device);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const deleteDevice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.device.delete({
      where: { id }
    });

    sendSuccess(res, { message: 'Device deleted successfully' });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getDeviceHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [statusHistory, accountHistory, hostHistory, maintenanceEvents] = await Promise.all([
      prisma.deviceStatusHistory.findMany({
        where: { deviceId: id },
        orderBy: { changedAt: 'desc' }
      }),
      prisma.deviceAccountHistory.findMany({
        where: { deviceId: id },
        include: { account: true },
        orderBy: { assignedAt: 'desc' }
      }),
      prisma.deviceHostHistory.findMany({
        where: { deviceId: id },
        include: { host: true },
        orderBy: { deployedAt: 'desc' }
      }),
      prisma.maintenanceEvent.findMany({
        where: { deviceId: id },
        orderBy: { performedAt: 'desc' }
      })
    ]);

    sendSuccess(res, {
      statusHistory,
      accountHistory,
      hostHistory,
      maintenanceEvents
    });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const assignAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { accountId, notes } = req.body;

    if (!accountId) {
      return sendError(res, 'Missing required field: accountId', 400);
    }

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    // Unassign previous account if exists
    if (device.currentAccountId) {
      await prisma.deviceAccountHistory.updateMany({
        where: {
          deviceId: id,
          accountId: device.currentAccountId,
          unassignedAt: null
        },
        data: {
          unassignedAt: new Date()
        }
      });
    }

    // Update device with new account
    const updatedDevice = await prisma.device.update({
      where: { id },
      data: { currentAccountId: accountId }
    });

    // Create history entry
    await prisma.deviceAccountHistory.create({
      data: {
        deviceId: id,
        accountId,
        notes
      }
    });

    sendSuccess(res, updatedDevice);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const assignHost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hostId, notes } = req.body;

    if (!hostId) {
      return sendError(res, 'Missing required field: hostId', 400);
    }

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    // Undeploy from previous host if exists
    if (device.currentHostId) {
      await prisma.deviceHostHistory.updateMany({
        where: {
          deviceId: id,
          hostId: device.currentHostId,
          undeployedAt: null
        },
        data: {
          undeployedAt: new Date()
        }
      });
    }

    // Update device with new host and set status to deployed
    const updatedDevice = await prisma.device.update({
      where: { id },
      data: {
        currentHostId: hostId,
        currentStatus: 'deployed'
      }
    });

    // Create history entries
    await Promise.all([
      prisma.deviceHostHistory.create({
        data: {
          deviceId: id,
          hostId,
          notes
        }
      }),
      prisma.deviceStatusHistory.create({
        data: {
          deviceId: id,
          status: 'deployed',
          notes: `Deployed to host`
        }
      })
    ]);

    sendSuccess(res, updatedDevice);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const changeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, changedBy, notes } = req.body;

    if (!status) {
      return sendError(res, 'Missing required field: status', 400);
    }

    const device = await prisma.device.update({
      where: { id },
      data: { currentStatus: status }
    });

    await prisma.deviceStatusHistory.create({
      data: {
        deviceId: id,
        status,
        changedBy,
        notes
      }
    });

    sendSuccess(res, device);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const addMaintenanceEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { eventType, description, performedBy, cost } = req.body;

    if (!eventType || !description) {
      return sendError(res, 'Missing required fields: eventType, description', 400);
    }

    const event = await prisma.maintenanceEvent.create({
      data: {
        deviceId: id,
        eventType,
        description,
        performedBy,
        cost: cost ? parseFloat(cost) : null
      }
    });

    sendSuccess(res, event, 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const unassignAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    if (device.currentAccountId) {
      await prisma.deviceAccountHistory.updateMany({
        where: {
          deviceId: id,
          accountId: device.currentAccountId,
          unassignedAt: null
        },
        data: {
          unassignedAt: new Date()
        }
      });
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: { currentAccountId: null }
    });

    sendSuccess(res, updatedDevice);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const unassignHost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return sendError(res, 'Device not found', 404);
    }

    if (device.currentHostId) {
      await prisma.deviceHostHistory.updateMany({
        where: {
          deviceId: id,
          hostId: device.currentHostId,
          undeployedAt: null
        },
        data: {
          undeployedAt: new Date()
        }
      });
    }

    const updatedDevice = await prisma.device.update({
      where: { id },
      data: { currentHostId: null }
    });

    sendSuccess(res, updatedDevice);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};