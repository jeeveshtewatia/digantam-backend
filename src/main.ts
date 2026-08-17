import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn'] // In prod, we keep 'log' but can remove it if you want it even cleaner
      : ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-device-id',
      'X-Requested-With',
    ],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Sketchers3D API')
    .setDescription(
      `
      Sketchers3D API - A comprehensive inventory management system with the following features:
      
      **Key Features:**
      - 🏗️ Multi-project support with dynamic schemas
      - 👥 Role-based access control (Super Admin, Admin, RM, User)
      - 🔐 JWT authentication
      - 📦 Inventory management
      - 👤 Customer management
      - 📋 Booking management with automatic inventory updates
      - 🔓 Support for open APIs (projects without authentication)
      - 📊 Custom schema definitions per project
      
      **Authentication:**
      - Register/Login to get JWT token
      - Use Bearer token for authenticated endpoints
      - Public endpoints don't require authentication
      
      **Project Management:**
      - Super Admin can create/manage projects
      - Each project can have custom inventory and customer schemas
      - Projects can be configured to require authentication or be open
      
      **Booking Flow:**
      - Create booking with customer (creates customer if new)
      - Automatically updates inventory status (available → hold → sold)
      - Support for booking cancellation and unit changes
      - Automatic release of expired bookings
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Health check and API information')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Projects Management', 'Manage projects (Super Admin only)')
    .addTag('Inventories', 'Inventory management for projects')
    .addTag('Customers', 'Customer management for projects')
    .addTag('Bookings', 'Booking management with automatic inventory updates')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Sketchers3D API Documentation',
  });

  const port = configService.get<number>('PORT', 8000);
  await app.listen(port);

  console.log('');
  console.log('========================================');
  console.log('🚀 Server is running!');
  console.log('========================================');
  console.log(`📍 URL: http://localhost:${port}`);
  console.log(`📚 Swagger Docs: http://localhost:${port}/api-docs`);
  console.log(`🔐 Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
  console.log('========================================');
  console.log('');
}

bootstrap();
