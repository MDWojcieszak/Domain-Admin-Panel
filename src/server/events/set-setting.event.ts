export class SetSettingEvent {
  constructor(
    public readonly serverName: string,

    public readonly name: string,
    public readonly value: string,
    public readonly category: string,
  ) {}
}
