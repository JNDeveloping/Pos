import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest<{ method?: string; originalUrl?: string; user?: { id?: string } }>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR,
      code = 'INTERNAL_ERROR',
      message = 'Ocurrió un error inesperado',
      details: unknown;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : String((body as { message?: string | string[] }).message ?? exception.message);
      details = Array.isArray((body as { message?: unknown }).message)
        ? (body as { message: unknown }).message
        : undefined;
      code = exception.name
        .replace(/Exception$/, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase();
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE_RESOURCE';
      const target = Array.isArray(exception.meta?.target) ? exception.meta.target.map(String) : [];
      message = target.includes('barcode')
        ? 'El código de barras ya está asignado a otro producto'
        : target.includes('operationId')
          ? 'La operación ya fue procesada'
          : 'Ya existe un registro con esos datos';
    }
    const context = `${request.method ?? 'UNKNOWN'} ${request.originalUrl ?? 'unknown'} user=${request.user?.id ?? 'anonymous'} status=${status} code=${code}`;
    if (status >= 500) this.logger.error(context, exception instanceof Error ? exception.stack : undefined);
    else this.logger.warn(context);
    response.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
  }
}
