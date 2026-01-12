import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class PostgresExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PostgresExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Postgres Error Codes
    // 23505 = unique_violation (Duplicate key)
    // 23503 = foreign_key_violation
    // P0001 = raise_exception (Custom user errors from PL/pgSQL)
    // 42501 = insufficient_privilege

    if (exception.code) {
      this.logger.warn(`DB Error: ${exception.code} - ${exception.message}`);

      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Internal database error';

      switch (exception.code) {
        case '23505': // Unique violation
          status = HttpStatus.CONFLICT;
          message = 'Запис з такими даними вже існує';
          break;
        case '23503': // FK violation
          status = HttpStatus.BAD_REQUEST;
          message = "Посилається на неіснуючий об'єкт";
          break;
        case '42501': // RLS / Permissions
          status = HttpStatus.FORBIDDEN;
          message = 'У вас немає прав на цю операцію';
          break;
        case 'P0001': // Custom RAISE EXCEPTION
          status = HttpStatus.BAD_REQUEST;
          message = exception.message; // Return the text from SQL function
          break;
        default:
          if (exception.code.startsWith('22')) {
            status = HttpStatus.BAD_REQUEST; // Data exception
            message = 'Некоректні дані';
          }
          break;
      }

      response.status(status).json({
        statusCode: status,
        message: message,
        error: exception.code,
      });
      return;
    }

    // Pass non-DB errors to default handler (or handle standard NestJS HTTP exceptions)
    if (exception.status) {
      response.status(exception.status).json(exception.response);
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
