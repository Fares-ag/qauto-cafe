import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { InsufficientStockError } from '../../inventory/inventory.types';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof InsufficientStockError) {
      response.status(409).json({
        type: 'https://api.qauto.cafe/errors/insufficient-stock',
        title: 'Insufficient Stock',
        status: 409,
        detail: 'Cannot complete payment. One or more ingredients are out of stock.',
        instance: request.url,
        errors: exception.shortages,
      });
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred.';
    let errors: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        detail = body;
        title = HttpStatus[status] ?? 'Error';
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        title = (obj.error as string) ?? (obj.title as string) ?? HttpStatus[status] ?? 'Error';
        detail = (obj.message as string) ?? detail;

        if (Array.isArray(obj.message)) {
          errors = obj.message.map((msg) => ({
            field: '_',
            message: String(msg),
          }));
          detail = 'One or more fields are invalid.';
          title = 'Validation Failed';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const typeSlug = title.toLowerCase().replace(/\s+/g, '-');

    response.status(status).json({
      type: `https://api.qauto.cafe/errors/${typeSlug}`,
      title,
      status,
      detail,
      instance: request.url,
      ...(errors ? { errors } : {}),
    });
  }
}
