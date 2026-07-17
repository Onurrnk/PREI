import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [GmailModule],
  controllers: [AgentController],
  providers: [AgentService, AgentKeyGuard],
})
export class AgentModule {}
