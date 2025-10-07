import { Request, Response } from 'express';
import prisma from '../utils/prisma';

function successResponse<T>(data: T) {
  return { success: true, data, error: null };
}

function errorResponse(error: string) {
  return { success: false, data: null, error };
}

// Get all settings
export async function getAllSettings(req: Request, res: Response) {
  try {
    const settings = await prisma.settings.findMany();

    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach((setting: any) => {
      settingsObj[setting.key] = setting.value;
    });

    res.json(successResponse(settingsObj));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
}

// Get single setting by key
export async function getSettingByKey(req: Request, res: Response) {
  try {
    const { key } = req.params;
    const setting = await prisma.settings.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json(errorResponse('Setting not found'));
    }

    res.json(successResponse(setting));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
}

// Update or create setting (upsert)
export async function upsertSetting(req: Request, res: Response) {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json(errorResponse('Key and value are required'));
    }

    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    res.json(successResponse(setting));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
}

// Batch update multiple settings
export async function batchUpdateSettings(req: Request, res: Response) {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json(errorResponse('Settings object is required'));
    }

    // Update each setting
    const results = await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        prisma.settings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    res.json(successResponse({ updated: results.length }));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
}

// Delete setting
export async function deleteSetting(req: Request, res: Response) {
  try {
    const { key } = req.params;

    await prisma.settings.delete({
      where: { key },
    });

    res.json(successResponse({ message: 'Setting deleted successfully' }));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
}
