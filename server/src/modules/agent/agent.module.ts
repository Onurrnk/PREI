import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { MetaDmController } from './meta-dm.controller';
import { AgentService } from './agent.service';
import { MetaDmService } from './meta-dm.service';
import { EylulBrainService } from './eylul-brain.service';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [GmailModule],
  // MetaDmController AgentController'dan ÖNCE: '/agent/meta-webhook' ve
  // '/agent/persona' yolları, AgentController'ın guard'lı rotalarıyla
  // karışmadan çözülsün.
  controllers: [MetaDmController, AgentController],
  providers: [AgentService, MetaDmService, EylulBrainService, AgentKeyGuard],
})
export class AgentModule {}
