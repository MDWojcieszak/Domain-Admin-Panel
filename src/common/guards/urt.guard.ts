import { AuthGuard } from '@nestjs/passport';

export class UrtGuard extends AuthGuard('jwt-register-user') {
  constructor() {
    super();
  }
}
