import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class DeviceAuthorizationResponse {
  /** Secret the app keeps and polls with. Never show this to the user. */
  @IsString()
  deviceCode: string;

  /** The short code the user sees, `XXXX-XXXX`. */
  @IsString({ example: 'WXYZ-1234' })
  userCode: string;

  @IsString({ example: 'https://panel.example.com/activate' })
  verificationUri: string;

  /** Same page with the code pre-filled — open this one. */
  @IsString({ example: 'https://panel.example.com/activate?code=WXYZ-1234' })
  verificationUriComplete: string;

  /** Seconds until the handshake expires. */
  @IsNumber({ type: 'integer' })
  expiresIn: number;

  /** Minimum seconds between polls; poll faster and you get `slow_down`. */
  @IsNumber({ type: 'integer' })
  interval: number;
}
