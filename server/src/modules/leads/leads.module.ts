import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { MeetingBriefController, AgentMeetingBriefController } from './meeting-brief.controller';
import { MeetingBriefService } from './meeting-brief.service';
import { AgentKeyGuard } from '../../auth/agent-key.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';

@Module({
  controllers: [MeetingBriefController, AgentMeetingBriefController, LeadsController],
  providers: [LeadsService, LeadsRepository, MeetingBriefService, JwtAuthGuard, RbacGuard, AgentKeyGuard],
})
export class LeadsModule {}
