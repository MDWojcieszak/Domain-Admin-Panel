import { IsString } from 'nestjs-swagger-dto';

import { OutboundMessage } from '../../common/decorators';

@OutboundMessage({
  pattern: 'setting.set',
  interaction: 'event',
  summary: 'Push a single setting value to the server agent.',
})
export class SetSettingEvent {
  @IsString()
  serverName: string;

  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsString()
  category: string;

  constructor(
    serverName: string,
    name: string,
    value: string,
    category: string,
  ) {
    this.serverName = serverName;
    this.name = name;
    this.value = value;
    this.category = category;
  }
}
