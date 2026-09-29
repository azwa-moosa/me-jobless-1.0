// UNVERIFIED (not compiled/run). Thin NestJS wrapper over PlatformService. Requires @nestjs/common.
import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, Post, Req, UseGuards, UseFilters, Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ForbiddenError } from '../../../../packages/auth/src/index.ts';
import type { AuthProvider } from '../../../../packages/auth/src/index.ts';
import { WorkflowError } from '../../../../packages/schemas/src/index.ts';
import type { PlatformService } from '../service.ts';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthProvider) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.authenticate(req.headers);
    return req.user !== null; // 403 by default in Nest; map to 401 in a filter if desired
  }
}

@Catch(ForbiddenError, WorkflowError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(e: ForbiddenError | WorkflowError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof ForbiddenError) return res.status(HttpStatus.FORBIDDEN).json({ error: 'FORBIDDEN', message: 'You do not have access to this resource.' });
    return res.status(e.code === 'NOT_FOUND' ? 404 : e.code === 'INVALID_INPUT' ? 400 : e.code === 'FORBIDDEN' ? 403 : 409).json({ error: e.code, message: e.message });
  }
}

@Controller()
@UseGuards(AuthGuard)
@UseFilters(DomainErrorFilter)
export class PlatformController {
  constructor(private readonly svc: PlatformService) {}
  @Get('reporting-periods') list(@Req() r: any) { return this.svc.listPeriods(r.user); }
  @Post('reporting-periods') create(@Req() r: any, @Body() b: any) { return this.svc.createPeriod(r.user, b); }
  @Post('reporting-periods/:id/uploads') upload(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.upload(r.user, id, b); }
  @Get('batches/:id') batch(@Req() r: any, @Param('id') id: string) { return this.svc.getBatchWithIssues(r.user, id); }
  @Post('batches/:id/issues/:issueId/resolve') resolve(@Req() r: any, @Param('id') id: string, @Param('issueId') iid: string, @Body() b: any) { return this.svc.resolve(r.user, id, iid, b); }
  @Post('batches/:id/approve') approve(@Req() r: any, @Param('id') id: string) { return this.svc.approve(r.user, id); }
  @Get('org-units') orgs(@Req() r: any) { return this.svc.listOrgUnits(r.user); }
}
