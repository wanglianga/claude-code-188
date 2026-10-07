import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/** 统一错误响应格式 { code, message } */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger('Exception');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    if (exception instanceof HttpException) {
      const body: any = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : Array.isArray(body?.message)
            ? body.message.join('；')
            : body?.message || exception.message;
    } else {
      this.logger.error(exception?.message, exception?.stack);
    }
    res.status(status).json({ code: status, message });
  }
}
