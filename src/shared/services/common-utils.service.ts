import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';

@Injectable()
export class CommonUtilsService {
  /**
   * Generate a unique ID
   */
  generateId(length: number = 10): string {
    return nanoid(length);
  }

  /**
   * Sanitize an object by removing undefined or null values
   */
  sanitizeObject(obj: any): any {
    const sanitized = { ...obj };
    Object.keys(sanitized).forEach((key) => {
      if (sanitized[key] === undefined || sanitized[key] === null) {
        delete sanitized[key];
      }
    });
    return sanitized;
  }
}
