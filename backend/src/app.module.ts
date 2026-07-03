import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { ReconnectManager } from './game/reconnect.manager';
import { RoomPersistenceService } from './game/room-persistence.service';
import { RoomBroadcaster } from './game/room.broadcaster';
import { RoomService } from './game/room.service';
import { TurnManager } from './game/turn.manager';
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
    RoomBroadcaster,
    TurnManager,
    ReconnectManager,
    RoomPersistenceService,
  ],
})
export class AppModule {}
