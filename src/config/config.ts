export const config = () => ({
  rabbitMQConfig: {
    urls: [process.env.RABBITMQ_URL],
    queue: process.env.MAIN_QUEUE,
    queueOptions: {
      durable: false,
    },
  },
});
