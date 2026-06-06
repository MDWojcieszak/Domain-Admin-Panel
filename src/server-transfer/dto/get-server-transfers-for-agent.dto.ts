import { IsString } from 'nestjs-swagger-dto';

export class GetServerTransfersForAgentDto {
  @IsString({
    description: 'Name of the server (Server.name) requesting its transfer tasks.',
  })
  serverName: string;
}
