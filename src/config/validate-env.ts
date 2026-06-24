/**
 * Startup environment validation. Fails fast in production when a required
 * variable is missing so a partially-configured deploy can't pass health-check
 * (audit release gate). In non-production it only warns, to keep local/dev
 * ergonomics. Call once at the top of bootstrap(), before NestFactory.create.
 */
const REQUIRED_ALWAYS = ['DATABASE_URL'];

const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_REGISTER_SECRET',
  'JWT_RESET_PASSWORD_SECRET',
  // Ed25519 signing key — LicenseService also refuses to boot without it in prod.
  'BLOG_LICENSE_PRIVATE_KEY',
  'SUPERUSER_EMAIL',
  'SUPERUSER_PASSWORD',
  // RabbitMQ — the agent message bus; the microservice can't start without it.
  'RABBITMQ_URL',
  // Mail — outbound emails (welcome, reset, notifications) silently fail otherwise.
  'MAIL_HOST',
  'MAIL_USER',
  'MAIL_PASS',
  // Panel URL — used for reset links and notification CTAs.
  'INTERFACE_URL',
  // CORS allow-list — without it the prod frontend origin is blocked (falls back to localhost).
  'ALLOWED_ORIGINS',
];

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const keys = [...REQUIRED_ALWAYS, ...(isProd ? REQUIRED_IN_PRODUCTION : [])];
  const missing = keys.filter((k) => !process.env[k]?.trim());

  if (missing.length === 0) {
    return;
  }
  const message = `Missing required environment variables: ${missing.join(', ')}`;
  if (isProd) {
    throw new Error(`FATAL (production): ${message}`);
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[env] ${message} (non-fatal in ${process.env.NODE_ENV ?? 'dev'})`,
  );
}
