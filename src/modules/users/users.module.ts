import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeController } from './me.controller.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

/** Global: the app-wide auth guard resolves the current user through UsersService. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [MeController],
  exports: [UsersService],
})
export class UsersModule {}
