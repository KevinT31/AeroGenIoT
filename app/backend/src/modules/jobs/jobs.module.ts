import { DynamicModule, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

type RedisConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
  lazyConnect: boolean;
  maxRetriesPerRequest: null;
  connectTimeout: number;
  retryStrategy: (attempt: number) => number;
};

const jobsEnabled = () => process.env.ENABLE_JOBS === "true";

const getRedisConnection = (): RedisConnection => {
  const common = {
    lazyConnect: true,
    maxRetriesPerRequest: null as null,
    connectTimeout: 10_000,
    retryStrategy: (attempt: number) => Math.min(attempt * 1000, 30_000),
  };

  const rawUrl = process.env.REDIS_URL;
  if (!rawUrl) {
    return { host: "localhost", port: 6379, ...common };
  }

  const url = new URL(rawUrl);
  const port = url.port ? Number(url.port) : 6379;
  const connection: RedisConnection = {
    host: url.hostname,
    port,
    ...common,
  };

  if (url.username) connection.username = decodeURIComponent(url.username);
  if (url.password) connection.password = decodeURIComponent(url.password);
  if (url.protocol === "rediss:") connection.tls = {};

  return connection;
};

@Module({})
export class JobsModule {
  static register(): DynamicModule {
    if (!jobsEnabled()) {
      return { module: JobsModule };
    }

    return {
      module: JobsModule,
      imports: [
        BullModule.forRoot({
          connection: getRedisConnection(),
        }),
        BullModule.registerQueue({ name: "ingest" }),
        BullModule.registerQueue({ name: "recommendations" }),
      ],
    };
  }
}
