import { Module } from '@nestjs/common';
import { RestaurantGateway } from './restaurant.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [RestaurantGateway],
  exports: [RestaurantGateway],
})
export class WebsocketsModule {}
