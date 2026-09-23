export const config = () => ({
  rabbitMQConfig: {
    urls: [process.env.RABBITMQ_URL],
    queue: process.env.MAIN_QUEUE,
    queueOptions: {
      durable: true,
    },
  },

  /**
   * Separate queue for the deployment agent, with MANUAL acknowledgement.
   *
   * The main queue runs on the NestJS default (`noAck: true`), which
   * acknowledges a message the moment it is delivered. That is tolerable for
   * Minecraft telemetry but not for deployments: while the backend drains a
   * backlog after deploying itself, a crash mid-drain would lose the logs and
   * the final status of a deployment that already happened
   * (docs/deploy-design.md §12.3).
   *
   * Kept apart from the main queue on purpose — switching that one to manual ack
   * would require every existing handler to acknowledge, which is a change to
   * working code for no gain here.
   */
  deployQueueConfig: {
    urls: [process.env.RABBITMQ_URL],
    queue: process.env.DEPLOY_QUEUE || 'deploy-agent',
    queueOptions: {
      durable: true,
      // Bounded backlog: a deployment that never reports must not grow the
      // broker without limit (§6.4).
      arguments: {
        'x-message-ttl': 30 * 60 * 1000,
        'x-max-length': 50_000,
      },
    },
    noAck: false,
    prefetchCount: 50,
  },
});
