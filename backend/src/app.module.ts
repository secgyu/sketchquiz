import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { RoomPersistenceService } from './game/room-persistence.service';
import { RoomService } from './game/room.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [PrismaModule, UserModule, AuthModule],
  controllers: [AppController],
  providers: [
    AppService,
    GameGateway,
    RoomService,
    GameService,
    RoomPersistenceService,
  ],
})
export class AppModule {}
