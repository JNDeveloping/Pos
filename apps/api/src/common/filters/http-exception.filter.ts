import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
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
    response.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
  }
}
