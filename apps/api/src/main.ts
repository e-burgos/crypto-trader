import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { setupSwagger } from './common/swagger/swagger.setup';
import { validateRequiredEnv } from './common/config/env.config';

async function bootstrap() {
  validateRequiredEnv();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });

  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    Logger.log(`📚 API docs available at: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  Logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
