import { AuthGuard } from '@nestjs/passport';

export class RptGuard extends AuthGuard('jwt-reset-password') {
  constructor() {
    super();
  }
}
