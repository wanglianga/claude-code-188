import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('社区上门理疗平台 API')
    .setDescription('预约-评估-派单-上门-疗程-异常-随访-结算-复诊 全链路接口')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, doc);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`API 已启动: http://localhost:${port}/api  (文档: /api/docs)`);
}
bootstrap();
