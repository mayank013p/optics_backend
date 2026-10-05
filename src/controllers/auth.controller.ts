import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    return ApiResponse.created(res, result);
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    return ApiResponse.success(res, result);
  }

  async requestOtp(req: Request, res: Response) {
    const result = await authService.requestOtp({
      email: req.body.email,
      purpose: req.body.purpose || 'LOGIN',
    });
    return ApiResponse.success(res, result);
  }

  async loginWithOtp(req: Request, res: Response) {
    const result = await authService.loginWithOtp({
      email: req.body.email,
      code: req.body.code,
    });
    return ApiResponse.success(res, result);
  }

  async registerWithOtp(req: Request, res: Response) {
    const result = await authService.registerWithOtp({
      email: req.body.email,
      code: req.body.code,
      password: req.body.password,
      name: req.body.name,
      orgName: req.body.orgName,
    });
    return ApiResponse.created(res, result);
  }

  async resetPasswordWithOtp(req: Request, res: Response) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const device = req.headers['user-agent'] || 'Web Browser';

    const result = await authService.resetPasswordWithOtp({
      email: req.body.email,
      code: req.body.code,
      newPassword: req.body.newPassword,
      ipAddress,
      device,
    });
    return ApiResponse.success(res, result);
  }

  async getMe(req: AuthenticatedRequest, res: Response) {
    const user = await authService.getProfile(req.user!.id);
    return ApiResponse.success(res, { user });
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    const { name, jobTitle, avatarUrl } = req.body;
    const user = await authService.updateProfile(req.user!.id, {
      name,
      jobTitle,
      avatarUrl,
    });
    return ApiResponse.success(res, { user, message: 'Profile updated successfully' });
  }

  async updatePassword(req: AuthenticatedRequest, res: Response) {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const device = req.headers['user-agent'] || 'Web Browser';

    const result = await authService.updatePassword(req.user!.id, {
      currentPassword,
      newPassword,
      ipAddress,
      device,
    });
    return ApiResponse.success(res, result);
  }
}

export const authController = new AuthController();
