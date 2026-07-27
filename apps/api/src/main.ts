import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
  );

  app.setGlobalPrefix('api');

  app.enableCors();

  await app.init();

  return server;
}

const appPromise = bootstrap();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
