import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors();

  if (process.env.VERCEL) {
    await app.init();
    return app.getHttpAdapter().getInstance();
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  return app;
}

export default bootstrap();
