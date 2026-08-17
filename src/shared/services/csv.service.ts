import { Injectable, BadRequestException } from '@nestjs/common';
import { Parser } from 'json2csv';
import * as csv from 'csvtojson';
import * as fs from 'fs';

@Injectable()
export class CsvService {
  /**
   * Convert JSON data to CSV string
   */
  jsonToCsv(data: any[], fields?: any[]): string {
    try {
      const opts = fields ? { fields } : {};
      const parser = new Parser(opts);
      return parser.parse(data);
    } catch (error) {
      throw new BadRequestException(`Failed to convert JSON to CSV: ${error.message}`);
    }
  }

  /**
   * Parse a CSV file to JSON
   */
  async parseFile(filePath: string): Promise<any[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException('CSV file not found');
      }
      return await csv().fromFile(filePath);
    } catch (error) {
      throw new BadRequestException(`Failed to parse CSV file: ${error.message}`);
    }
  }

  /**
   * Parse a CSV string to JSON
   */
  async parseString(csvString: string): Promise<any[]> {
    try {
      return await csv().fromString(csvString);
    } catch (error) {
      throw new BadRequestException(`Failed to parse CSV string: ${error.message}`);
    }
  }
}
