import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';

export const getAllAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        currentDevices: true
      },
      orderBy: {
        appleId: 'asc'
      }
    });
    sendSuccess(res, accounts);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAccountById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        currentDevices: true,
        deviceHistory: {
          include: {
            device: true
          },
          orderBy: {
            assignedAt: 'desc'
          }
        }
      }
    });

    if (!account) {
      return sendError(res, 'Account not found', 404);
    }

    sendSuccess(res, account);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { appleId, country, status, notes, password, twoFactor } = req.body;

    if (!appleId) {
      return sendError(res, 'Missing required field: appleId', 400);
    }

    const account = await prisma.account.create({
      data: {
        appleId,
        country,
        status,
        notes,
        password,
        twoFactor
      }
    });

    sendSuccess(res, account, 201);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { country, status, notes, password, twoFactor } = req.body;

    const account = await prisma.account.update({
      where: { id },
      data: {
        country,
        status,
        notes,
        password,
        twoFactor
      }
    });

    sendSuccess(res, account);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if account is currently assigned to any device
    const devicesWithAccount = await prisma.device.findMany({
      where: { currentAccountId: id }
    });

    if (devicesWithAccount.length > 0) {
      return sendError(res, 'Cannot delete account that is currently assigned to devices', 400);
    }

    await prisma.account.delete({
      where: { id }
    });

    sendSuccess(res, { message: 'Account deleted successfully' });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};