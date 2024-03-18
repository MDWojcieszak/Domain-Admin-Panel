import { IsNotEmpty, IsString } from 'class-validator';

export class CommandContext {
  serverId: string;
  categoryId: string;
  userId: string;
}
