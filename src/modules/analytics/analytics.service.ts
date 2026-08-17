import { Injectable, Logger } from '@nestjs/common';
import { ProjectsUtilsService } from '../../database/projects-utils.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private projectsUtilsService: ProjectsUtilsService) {}

  async getDashboardSummary(projectId: string) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);
    const CustomerModel = await this.projectsUtilsService.getCustomersModel(projectId);
    const BookingModel = await this.projectsUtilsService.getBookingsModel(projectId);

    const [totalUnits, soldUnits, holdUnits, totalCustomers, totalBookings] = await Promise.all([
      InventoryModel.countDocuments({ project_id: projectId }),
      InventoryModel.countDocuments({ project_id: projectId, status: 'sold' }),
      InventoryModel.countDocuments({ project_id: projectId, status: 'hold' }),
      CustomerModel.countDocuments({ project_id: projectId }),
      BookingModel.countDocuments({ project_id: projectId }),
    ]);

    return {
      inventory: {
        total: totalUnits,
        sold: soldUnits,
        hold: holdUnits,
        available: totalUnits - soldUnits - holdUnits,
      },
      customers: {
        total: totalCustomers,
      },
      bookings: {
        total: totalBookings,
      },
    };
  }

  async getInventoryStatusBreakdown(projectId: string) {
    const InventoryModel = await this.projectsUtilsService.getInventoriesModel(projectId);
    
    const stats = await InventoryModel.aggregate([
      { $match: { project_id: projectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return stats.map(s => ({
      status: s._id || 'unknown',
      count: s.count
    }));
  }

  async getRecentActivity(projectId: string) {
    const CSVHistoryModel = this.projectsUtilsService.getCSVHistoryModel();
    
    const activity = await CSVHistoryModel.find({ project_id: projectId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return activity;
  }
}
