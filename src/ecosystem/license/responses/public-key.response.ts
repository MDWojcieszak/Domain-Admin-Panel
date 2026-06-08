import { IsString } from 'nestjs-swagger-dto';

export class PublicKeyResponse {
  /** Ed25519 public key (PEM SPKI) for offline license verification. */
  @IsString()
  publicKey: string;
}
