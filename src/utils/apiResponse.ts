import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, data: T, statusCode = 200): Response {
    return res.status(statusCode).json(data);
  }

  static created<T>(res: Response, data: T): Response {
    return res.status(201).json(data);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }
}
