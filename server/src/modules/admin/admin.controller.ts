// =====================================================================
// PREI | AdminController — /api/admin/team, /api/admin/team/:id
// 'admin' izni (yalnız super_admin).
// =====================================================================
import {
  Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RbacGuard } from '../../common/rbac.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { Ctx } from '../../auth/context.decorator';
import type { RequestContext } from '../../common/request-context';
import { AdminService, type UploadedLogoLike } from './admin.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('team')
  listTeam(@Ctx() ctx: RequestContext) {
    return this.admin.listTeam(ctx);
  }

  @Get('team/:id')
  userDetail(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.admin.userDetail(ctx, id);
  }

  @Post('team')
  createTeamMember(@Ctx() ctx: RequestContext, @Body() dto: CreateTeamMemberDto) {
    return this.admin.createTeamMember(ctx, dto);
  }

  @Patch('team/:id')
  updateTeamMember(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.admin.updateTeamMember(ctx, id, dto);
  }

  @Get('roles')
  listRoles(@Ctx() ctx: RequestContext) {
    return this.admin.listRoles(ctx);
  }

  @Get('branding')
  getBranding(@Ctx() ctx: RequestContext) {
    return this.admin.getBranding(ctx);
  }

  @Patch('branding')
  updateBranding(@Ctx() ctx: RequestContext, @Body() dto: UpdateBrandingDto) {
    return this.admin.updateBranding(ctx, dto);
  }

  @Post('branding/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(@Ctx() ctx: RequestContext, @UploadedFile() file: UploadedLogoLike) {
    return this.admin.uploadLogo(ctx, file);
  }
}
