import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null
  };
  res.status(statusCode).json(response);
};

export const sendError = (res: Response, error: string, statusCode: number = 500) => {
  const response: ApiResponse = {
    success: false,
    data: null,
    error
  };
  res.status(statusCode).json(response);
};