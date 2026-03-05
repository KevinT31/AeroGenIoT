import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { FarmsModule } from "./modules/farms/farms.module";
import { PlotsModule } from "./modules/plots/plots.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { ReadingsModule } from "./modules/readings/readings.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { ThresholdsModule } from "./modules/thresholds/thresholds.module";
import { SystemModule } from "./modules/system/system.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { AiModule } from "./modules/ai/ai.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { MarketModule } from "./modules/market/market.module";
import { NearbyModule } from "./modules/nearby/nearby.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { CropsModule } from "./modules/crops/crops.module";
import { ZonesModule } from "./modules/zones/zones.module";
import { SourcesModule } from "./modules/sources/sources.module";
import { AdminModule } from "./modules/admin/admin.module";
import { KpisModule } from "./modules/kpis/kpis.module";
import { MeModule } from "./modules/me/me.module";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditInterceptor } from "./modules/common/audit.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FarmsModule,
    PlotsModule,
    DevicesModule,
    ReadingsModule,
    RecommendationsModule,
    AlertsModule,
    ThresholdsModule,
    SystemModule,
    JobsModule.register(),
    NotificationsModule,
    RealtimeModule,
    AiModule,
    ReportsModule,
    MarketModule,
    NearbyModule,
    UploadsModule,
    CropsModule,
    ZonesModule,
    SourcesModule,
    AdminModule,
    KpisModule,
    MeModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
