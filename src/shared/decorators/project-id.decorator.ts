import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ProjectId = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.projectId || request.params.projectId;
});
