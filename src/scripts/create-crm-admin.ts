import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectsUtilsService } from '../database/projects-utils.service';
import { CrmRole } from '../config/constants';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const projectsUtilsService = app.get(ProjectsUtilsService);
    const CrmUserModel = projectsUtilsService.getCrmUserModel();

    const email = 'admin@crm.com';
    const password = 'Admin@123';
    const name = 'System Admin';

    const existing = await CrmUserModel.findOne({ email });
    if (existing) {
        console.log('❌ Admin user already exists');
        await app.close();
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await CrmUserModel.create({
        name,
        email,
        passwordHash,
        role: CrmRole.ADMIN,
        companyId: 'default',
        isActive: true,
    });

    console.log('✅ CRM Admin created successfully!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);

    await app.close();
}

bootstrap().catch((err) => {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
});
