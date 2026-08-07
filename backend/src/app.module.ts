import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { V0Controller } from './http/v0.controller';

@Module({
  imports: [],
  controllers: [AppController, V0Controller],
  providers: [AppService],
})
export class AppModule {}
