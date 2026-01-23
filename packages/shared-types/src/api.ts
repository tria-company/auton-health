export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        timestamp: string;
        request_id?: string;
        [key: string]: any;
    };
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
}

export interface ApiError {
    status: number;
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
}
