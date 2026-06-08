// middlewares/errorHandler.ts
import { NextFunction, Request, Response } from 'express'

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error('Global Error Handler:', err) // Log error for debugging

  // Send a clean response to the client
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  })
}
