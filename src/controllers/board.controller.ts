import { Response } from 'express';
import { boardService } from '../services/board.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class BoardController {
  async getBoardByProjectId(req: AuthenticatedRequest, res: Response) {
    const board = await boardService.getBoardByProjectId(String(req.params.projectId));
    return ApiResponse.success(res, { board });
  }

  async getBoardDetails(req: AuthenticatedRequest, res: Response) {
    const board = await boardService.getBoardDetails(String(req.params.boardId));
    return ApiResponse.success(res, { board });
  }

  async addColumn(req: AuthenticatedRequest, res: Response) {
    const { name, color, wipLimit } = req.body;
    const column = await boardService.addColumn(
      String(req.params.boardId),
      name,
      color,
      wipLimit ? Number(wipLimit) : undefined
    );
    return ApiResponse.created(res, { column });
  }

  async deleteColumn(req: AuthenticatedRequest, res: Response) {
    const result = await boardService.deleteColumn(String(req.params.columnId));
    return ApiResponse.success(res, result);
  }
}

export const boardController = new BoardController();
