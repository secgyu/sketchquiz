import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './game/game.gateway';
import { RoomService } from './game/room.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, GameGateway, RoomService],
})
export class AppModule {}
