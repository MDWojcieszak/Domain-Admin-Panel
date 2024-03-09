export class UserCreatedEvent {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
  ) {}
}
