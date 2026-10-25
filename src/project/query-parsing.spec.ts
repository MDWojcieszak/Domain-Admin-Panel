import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';

import { ListProjectsQueryDto, ListTasksQueryDto } from './dto';

/**
 * Query strings carry text. Through the app's own pipe (main.ts), "false"
 * must reach the service as false: as the string it was truthy, so the open
 * projects list asked for archived ones and came back empty.
 */
describe('boolean query parameters', () => {
  const pipe = new ValidationPipe({ whitelist: true });
  const parse = <T>(metatype: new () => T, value: Record<string, string>) =>
    pipe.transform(value, {
      type: 'query',
      metatype,
    } as ArgumentMetadata) as Promise<T>;

  it('reads archived and templates as booleans', async () => {
    const open = await parse(ListProjectsQueryDto, { archived: 'false' });
    expect(open.archived).toBe(false);
    const archived = await parse(ListProjectsQueryDto, { archived: 'true' });
    expect(archived.archived).toBe(true);
    const templates = await parse(ListProjectsQueryDto, { templates: 'true' });
    expect(templates.templates).toBe(true);
  });

  it('reads withSubtasks as a boolean', async () => {
    const query = await parse(ListTasksQueryDto, { withSubtasks: 'false' });
    expect(query.withSubtasks).toBe(false);
  });
});
