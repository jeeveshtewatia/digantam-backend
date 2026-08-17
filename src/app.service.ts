import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      message: 'Sketchers3D API is running',
      timestamp: new Date().toISOString(),
    };
  }

  getInfo() {
    return {
      name: 'Sketchers3D API',
      version: '1.0.0',
      description: 'A scalable multi-project inventory management system built with NestJS by Sketchers3D',
      features: [
        'Multi-project support',
        'Dynamic schema management',
        'Role-based access control',
        'JWT authentication',
        'Open API support',
        'Swagger documentation',
      ],
    };
  }
}
