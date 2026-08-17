import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ProjectsUtilsService } from '../../database/projects-utils.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserRole } from '../../config/constants';

@Injectable()
export class AuthService {
  constructor(
    private projectsUtilsService: ProjectsUtilsService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto, currentUser?: any) {
    const UserModel = this.projectsUtilsService.getUserModel();

    // Check if email already exists for this project (or globally if no project_id)
    const existingUserQuery: any = { email: registerDto.email };

    if (registerDto.project_id) {
      // For project-specific users, check if email exists in the same project
      existingUserQuery.project_id = registerDto.project_id;
    } else {
      // For global users (super admin, etc.), check if email exists without project_id
      existingUserQuery.$or = [
        { project_id: { $exists: false } },
        { project_id: null },
      ];
    }

    const existingUser = await UserModel.findOne(existingUserQuery);
    if (existingUser) {
      if (registerDto.project_id) {
        throw new ConflictException(
          `Email already registered for project ${registerDto.project_id}`,
        );
      } else {
        throw new ConflictException('Email already registered');
      }
    }

    // Validate role assignment
    if (registerDto.role) {
      if (registerDto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot create super admin user');
      }

      // Admin user creation: Super admin can create for any project, Admin can create for their own project
      if (registerDto.role === UserRole.ADMIN) {
        if (!currentUser) {
          throw new ForbiddenException('Only super admin or admin can create admin users');
        }

        // Super admin can create admin for any project
        if (currentUser.role === UserRole.SUPER_ADMIN) {
          // Allow - super admin can create admin for any project
        }
        // Admin can create admin only for their own project
        else if (currentUser.role === UserRole.ADMIN) {
          // Check if creating for same project
          if (!currentUser.project_id || !registerDto.project_id) {
            throw new ForbiddenException('Project ID required for admin user creation');
          }
          if (currentUser.project_id !== registerDto.project_id) {
            throw new ForbiddenException(
              `You can only create admin users for your own project (${currentUser.project_id})`,
            );
          }
          // Allow - admin can create admin for their own project
        } else {
          throw new ForbiddenException('Only super admin or admin can create admin users');
        }
      }

      // Only admin and super admin can create RM users
      if (
        registerDto.role === UserRole.RM &&
        (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN))
      ) {
        throw new ForbiddenException('Only admin and super admin can create RM users');
      }
    }

    // Validate project_id if provided
    if (registerDto.project_id) {
      const isValidProject = await this.projectsUtilsService.isValidProjectId(registerDto.project_id);
      if (!isValidProject) {
        throw new BadRequestException('Invalid project ID');
      }
    }

    // Project-specific access control for user creation
    if (registerDto.project_id && currentUser) {
      // Super admin can create users for any project
      if (currentUser.role === UserRole.SUPER_ADMIN) {
        // Allow - super admin has access to all projects
      }
      // Admin can only create users for their own project
      else if (currentUser.role === UserRole.ADMIN) {
        if (currentUser.project_id && currentUser.project_id !== registerDto.project_id) {
          throw new ForbiddenException(
            `You can only create users for your own project (${currentUser.project_id})`,
          );
        }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Prepare creator information (if user is authenticated)
    const createdBy = currentUser
      ? {
          user_id: currentUser._id?.toString() || currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
          name: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
        }
      : undefined;

    // Create user
    const user = await UserModel.create({
      ...registerDto,
      password: hashedPassword,
      role: registerDto.role || UserRole.USER,
      created_by: createdBy,
    });

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        project_id: user.project_id,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const UserModel = this.projectsUtilsService.getUserModel();

    // Find user by email
    const user = await UserModel.findOne({ email: loginDto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        project_id: user.project_id,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const UserModel = this.projectsUtilsService.getUserModel();
    const user = await UserModel.findById(userId).select('-password');

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateUserStatus(userId: string, updateStatusDto: UpdateUserStatusDto, currentUser: any) {
    const UserModel = this.projectsUtilsService.getUserModel();

    // Find the user to update
    const userToUpdate = await UserModel.findById(userId);
    if (!userToUpdate) {
      throw new NotFoundException('User not found');
    }

    // Authorization checks
    // Super admin can activate/deactivate admin or RM (anyone)
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // Super admin can update anyone
      userToUpdate.is_active = updateStatusDto.is_active;
      await userToUpdate.save();

      return {
        message: `User ${updateStatusDto.is_active ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: userToUpdate._id,
          email: userToUpdate.email,
          firstName: userToUpdate.firstName,
          lastName: userToUpdate.lastName,
          role: userToUpdate.role,
          project_id: userToUpdate.project_id,
          is_active: userToUpdate.is_active,
        },
      };
    }

    // Admin can only activate/deactivate RM users of their own project
    if (currentUser.role === UserRole.ADMIN) {
      // Check if user to update is RM
      if (userToUpdate.role !== UserRole.RM) {
        throw new ForbiddenException('You can only activate/deactivate RM users');
      }

      // Check if RM belongs to admin's project
      if (!currentUser.project_id || !userToUpdate.project_id) {
        throw new ForbiddenException('Project information not found');
      }

      if (currentUser.project_id !== userToUpdate.project_id) {
        throw new ForbiddenException(
          `You can only manage RM users from your own project (${currentUser.project_id})`,
        );
      }

      // Update status
      userToUpdate.is_active = updateStatusDto.is_active;
      await userToUpdate.save();

      return {
        message: `RM user ${updateStatusDto.is_active ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: userToUpdate._id,
          email: userToUpdate.email,
          firstName: userToUpdate.firstName,
          lastName: userToUpdate.lastName,
          role: userToUpdate.role,
          project_id: userToUpdate.project_id,
          is_active: userToUpdate.is_active,
        },
      };
    }

    // Other roles cannot update user status
    throw new ForbiddenException('You do not have permission to update user status');
  }

  async getProjectUsersStats(projectId: string, currentUser: any) {
    const UserModel = this.projectsUtilsService.getUserModel();

    // Authorization checks
    // Super admin can view users from any project
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // Super admin can view any project's users
    }
    // Admin can only view users from their own project
    else if (currentUser.role === UserRole.ADMIN) {
      if (!currentUser.project_id || currentUser.project_id !== projectId) {
        throw new ForbiddenException(
          `You can only view users from your own project (${currentUser.project_id})`,
        );
      }
    } else {
      throw new ForbiddenException('You do not have permission to view project users');
    }

    // Get counts using aggregation for better performance
    const stats = await UserModel.aggregate([
      {
        $match: {
          project_id: projectId,
          role: { $in: [UserRole.ADMIN, UserRole.RM] },
        },
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ['$is_active', true] }, 1, 0],
            },
          },
          inactive: {
            $sum: {
              $cond: [{ $eq: ['$is_active', false] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Format the response
    const adminStats = stats.find((s) => s._id === UserRole.ADMIN) || {
      _id: UserRole.ADMIN,
      count: 0,
      active: 0,
      inactive: 0,
    };
    const rmStats = stats.find((s) => s._id === UserRole.RM) || {
      _id: UserRole.RM,
      count: 0,
      active: 0,
      inactive: 0,
    };

    const total = adminStats.count + rmStats.count;
    const totalActive = adminStats.active + rmStats.active;
    const totalInactive = adminStats.inactive + rmStats.inactive;

    return {
      message: 'Project users statistics retrieved successfully',
      project_id: projectId,
      total: {
        count: total,
        active: totalActive,
        inactive: totalInactive,
      },
      admins: {
        count: adminStats.count,
        active: adminStats.active,
        inactive: adminStats.inactive,
      },
      rms: {
        count: rmStats.count,
        active: rmStats.active,
        inactive: rmStats.inactive,
      },
    };
  }

  async getProjectUsers(projectId: string, currentUser: any, role?: string) {
    const UserModel = this.projectsUtilsService.getUserModel();

    // Authorization checks
    // Super admin can view users from any project
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // Super admin can view any project's users
    }
    // Admin can only view users from their own project
    else if (currentUser.role === UserRole.ADMIN) {
      if (!currentUser.project_id || currentUser.project_id !== projectId) {
        throw new ForbiddenException(
          `You can only view users from your own project (${currentUser.project_id})`,
        );
      }
    } else {
      throw new ForbiddenException('You do not have permission to view project users');
    }

    // Build query
    const query: any = {
      project_id: projectId,
    };

    // Filter by role if provided
    if (role) {
      if (role === 'admin') {
        query.role = UserRole.ADMIN;
      } else if (role === 'rm') {
        query.role = UserRole.RM;
      } else if (role === 'admin,rm' || role === 'rm,admin') {
        query.role = { $in: [UserRole.ADMIN, UserRole.RM] };
      }
    } else {
      // Default: return both admin and RM users
      query.role = { $in: [UserRole.ADMIN, UserRole.RM] };
    }

    // Fetch users (exclude password)
    const users = await UserModel.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Group by role for better dashboard display
    const groupedUsers = {
      admins: users.filter((u) => u.role === UserRole.ADMIN),
      rms: users.filter((u) => u.role === UserRole.RM),
    };

    return {
      message: 'Project users retrieved successfully',
      project_id: projectId,
      total: users.length,
      admins: groupedUsers.admins.length,
      rms: groupedUsers.rms.length,
      users: users,
      grouped: groupedUsers, // Optional: grouped format for easier frontend consumption
    };
  }

  private generateToken(user: any): string {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      project_id: user.project_id,
    };

    return this.jwtService.sign(payload);
  }
}
