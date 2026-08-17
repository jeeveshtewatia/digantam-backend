import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../config/constants';
import { ProjectsUtilsService } from './projects-utils.service';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
    private projectsUtilsService: ProjectsUtilsService,
  ) { }

  async onModuleInit() {
    console.log('📦 Database connected successfully');
    // Small delay to ensure all schemas are registered
    await new Promise((resolve) => setTimeout(resolve, 500));
    await this.createUserIndexes();
    await this.createSuperAdmin();
  }

  /**
   * Create compound indexes for email uniqueness per project
   * - Email + project_id must be unique for project-specific users
   * - Email must be unique for global users (no project_id)
   */
  private async createUserIndexes() {
    try {
      const UserModel = this.projectsUtilsService.getUserModel();

      // Drop existing unique index on email if it exists
      try {
        await UserModel.collection.dropIndex('email_1');
        console.log('ℹ️  Dropped old email unique index');
      } catch (error) {
        // Index might not exist, that's okay
      }

      // Create compound unique index for email + project_id
      // This ensures email is unique per project
      // partialFilterExpression only supports equality and $exists, $type, $gt, $gte, $lt, $lte
      await UserModel.collection.createIndex(
        { email: 1, project_id: 1 },
        {
          unique: true,
          partialFilterExpression: { project_id: { $type: 'string' } },
          name: 'email_project_unique',
        },
      );

      // Create unique index for email when project_id is missing or explicitly null
      // Since $or is not supported in partialFilterExpression, we use a different approach
      // The most reliable way for "missing or null" in partial indexes often requires multiple indexes
      // or ensuring the field is consistently null for global users.
      await UserModel.collection.createIndex(
        { email: 1 },
        {
          unique: true,
          partialFilterExpression: { project_id: null },
          name: 'email_global_unique',
        },
      );

    } catch (error: any) {
      console.error('❌ Error creating user indexes:', error.message);
      // Don't throw - indexes might already exist
    }
  }

  private async createSuperAdmin() {
    try {
      const User = this.projectsUtilsService.getUserModel();
      const superAdminEmail = this.configService.get<string>('SUPER_ADMIN_EMAIL', 'superadmin@example.com');
      const superAdminPassword = this.configService.get<string>('SUPER_ADMIN_PASSWORD', 'SuperAdmin@123');

      const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

      if (!existingSuperAdmin) {
        const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

        await User.create({
          email: superAdminEmail,
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          is_active: true,
        });

        console.log('✅ Super admin created successfully');
        console.log(`📧 Email: ${superAdminEmail}`);
        console.log(`🔑 Password: ${superAdminPassword}`);
      } else {
        console.log('ℹ️  Super admin already exists');
        console.log(`📧 Email: ${superAdminEmail}`);
      }
    } catch (error: any) {
      console.error('❌ Error creating super admin:', error.message);
      console.log('ℹ️  You can create a super admin manually via the register endpoint');
    }
  }
}
