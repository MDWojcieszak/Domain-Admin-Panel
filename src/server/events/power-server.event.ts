class PowerServerContext {
  serverId: string;
}

export class PowerServerEvent {
  constructor(public readonly context: PowerServerContext) {}
}
