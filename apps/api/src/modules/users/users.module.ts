import { Module } from '@nestjs/common';
import { UserAdminService } from './user-admin.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UserAdminService],
})
export class UsersModule {}
