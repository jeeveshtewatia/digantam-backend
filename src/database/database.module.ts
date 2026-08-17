import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { ProjectsUtilsService } from './projects-utils.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        
        // Get environment-specific URI or fallback to default
        const mongodbUri = 
          configService.get<string>(`MONGODB_URI_${nodeEnv.toUpperCase()}`) ||
          configService.get<string>('MONGODB_URI');

        if (!mongodbUri) {
          throw new Error(`MONGODB_URI is required for ${nodeEnv} environment`);
        }

        console.log(`📦 Connecting to MongoDB for ${nodeEnv} environment`);

        return {
          uri: mongodbUri,
          retryWrites: true,
          w: 'majority',
        };
      },
    }),
  ],
  providers: [DatabaseService, ProjectsUtilsService],
  exports: [DatabaseService, ProjectsUtilsService],
})
export class DatabaseModule {}
