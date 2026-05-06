import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Aumentar límite de body para soportar logos en base64 (~15 MB)
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  // Security headers
  app.use(helmet());

  // CORS — sólo orígenes permitidos
  const allowedOrigins = [
    configService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
    configService.get<string>('KIOSK_URL', 'http://localhost:5174'),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation pipe — sanitización de toda entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // elimina propiedades no declaradas en DTOs
      forbidNonWhitelisted: true,
      transform: true,          // transforma tipos automáticamente
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (sólo en desarrollo)
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('RestaurantOS API')
      .setDescription('API completa de administración de restaurante multi-sucursal')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🍽️  RestaurantOS API corriendo en: http://localhost:${port}/api`);
  console.log(`📚 Documentación Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
