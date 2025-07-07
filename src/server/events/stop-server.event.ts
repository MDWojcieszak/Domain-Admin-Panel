class StopServerContext {
  serverId: string;
}

export class StopServerEvent {
  constructor(public readonly context: StopServerContext) {}
}
