// middlewares/setCharset.ts
import { NextFunction, Request, Response } from 'express'

export const setCharset = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  next()
}
