import { z } from 'zod';

export const loginInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginInput>;

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Min 8 characters'),
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
}
