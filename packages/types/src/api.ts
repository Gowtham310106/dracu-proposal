export interface ApiSuccess<T> { success: true; data: T; meta?: PageMeta }
export interface ApiFailure { success: false; error: { code: string; message: string; details?: unknown } }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PageMeta { page: number; limit: number; total: number; pages: number }

export interface ListQuery {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  from?: string;
  to?: string;
  branchId?: string;
  status?: string;
}

export interface Timestamped {
  _id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}
