---
id: configuration
title: Configuration
---

## Basic Configuration

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    namespace: 'default',
  },
  taskQueue: 'my-task-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [PaymentActivity, EmailActivity],
    autoStart: true,
    maxConcurrentActivityExecutions: 100,
  },
  logLevel: 'info',
  enableLogger: true,
})
```

## Multiple Workers Configuration

**New in 3.0.12**: Support for multiple workers with different task queues in the same process.

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    namespace: 'default',
  },
  autoRestart: true,  // Global default for all workers
  maxRestarts: 3,     // Global default for all workers
  workers: [
    {
      taskQueue: 'payments-queue',
      workflowsPath: require.resolve('./workflows/payments'),
      activityClasses: [PaymentActivity, RefundActivity],
      autoStart: true,
      maxRestarts: 5,  // Override for this critical worker
      workerOptions: {
        maxConcurrentActivityTaskExecutions: 100,
      },
    },
    {
      taskQueue: 'notifications-queue',
      workflowsPath: require.resolve('./workflows/notifications'),
      activityClasses: [EmailActivity, SmsActivity],
      autoStart: true,
      workerOptions: {
        maxConcurrentActivityTaskExecutions: 50,
      },
    },
    {
      taskQueue: 'background-jobs',
      workflowsPath: require.resolve('./workflows/jobs'),
      activityClasses: [DataProcessingActivity],
      autoStart: false,    // Start manually later
      autoRestart: false,  // Disable auto-restart for this worker
    },
  ],
  logLevel: 'info',
  enableLogger: true,
})
```

### Accessing Multiple Workers

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class WorkerManagementService {
  constructor(private readonly temporal: TemporalService) {}

  async checkWorkerStatus() {
    // Get all workers info
    const workersInfo = this.temporal.getAllWorkers();
    console.log(`Total workers: ${workersInfo.totalWorkers}`);
    console.log(`Running workers: ${workersInfo.runningWorkers}`);

    // Get specific worker status
    const paymentWorkerStatus = this.temporal.getWorkerStatusByTaskQueue('payments-queue');
    if (paymentWorkerStatus?.isHealthy) {
      console.log('Payment worker is healthy');
    }
  }

  async controlWorkers() {
    // Start a specific worker
    await this.temporal.startWorkerByTaskQueue('background-jobs');

    // Stop a specific worker
    await this.temporal.stopWorkerByTaskQueue('notifications-queue');
  }

  async registerNewWorker() {
    // Dynamically register a new worker at runtime
    const result = await this.temporal.registerWorker({
      taskQueue: 'new-queue',
      workflowsPath: require.resolve('./workflows/new'),
      activityClasses: [NewActivity],
      autoStart: true,
    });

    if (result.success) {
      console.log(`Worker registered for queue: ${result.taskQueue}`);
    }
  }
}
```

## Declarative Worker Registration with @TemporalWorkerController

Instead of centralizing every task queue's config in `TemporalModule.register()`, you can declare a worker next to the code it configures with `@TemporalWorkerController` — the same idea as `@Controller` declaring a route group. It's discovered automatically the same way `@Activity` classes are, and produces an entry equivalent to one item in `TemporalOptions.workers`.

```typescript
import { TemporalWorkerController } from 'nestjs-temporal-core';
import { OrderActivities } from './order.activities';

@TemporalWorkerController({
  taskQueue: 'orders',
  workflowsPath: require.resolve('./workflows/orders'),
  activityClasses: [OrderActivities],
  autoStart: true,
})
export class OrdersWorker {}
```

The decorated class must still be registered as a NestJS provider — `DiscoveryModule` only sees registered providers/controllers:

```typescript
@Module({
  imports: [TemporalModule.register({ connection: { address: 'localhost:7233' } })],
  providers: [OrdersWorker, OrderActivities],
})
export class OrdersModule {}
```

Notes:

- `TemporalOptions.workers` and `@TemporalWorkerController` can be combined freely — workers from both sources are merged by task queue.
- If a task queue appears in both an explicit `workers` entry and a `@TemporalWorkerController`, the explicit entry wins (a warning is logged).
- Two `@TemporalWorkerController` classes declaring the **same** task queue is a startup error, since that's always a configuration mistake.
- Omitting `activityClasses` uses all discovered activities, same as `WorkerDefinition`.

## Manual Worker Creation (Advanced)

For users who need full control, you can access the native Temporal connection to create custom workers:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Worker } from '@temporalio/worker';

@Injectable()
export class CustomWorkerService implements OnModuleInit {
  private customWorker: Worker;

  constructor(private readonly temporal: TemporalService) {}

  async onModuleInit() {
    const workerManager = this.temporal.getWorkerManager();
    const connection = workerManager.getConnection();

    if (!connection) {
      throw new Error('No connection available');
    }

    // Create your custom worker using the native Temporal SDK
    this.customWorker = await Worker.create({
      connection,
      taskQueue: 'custom-task-queue',
      namespace: 'default',
      workflowsPath: require.resolve('./workflows/custom'),
      activities: {
        myCustomActivity: async (data: string) => {
          return `Processed: ${data}`;
        },
      },
    });

    // Start the worker
    await this.customWorker.run();
  }
}
```

## Async Configuration

For dynamic configuration using environment variables or config services:

```typescript
// config/temporal.config.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemporalOptionsFactory, TemporalOptions } from 'nestjs-temporal-core';

@Injectable()
export class TemporalConfigService implements TemporalOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTemporalOptions(): TemporalOptions {
    return {
      connection: {
        address: this.configService.get('TEMPORAL_ADDRESS', 'localhost:7233'),
        namespace: this.configService.get('TEMPORAL_NAMESPACE', 'default'),
      },
      taskQueue: this.configService.get('TEMPORAL_TASK_QUEUE', 'default'),
      worker: {
        workflowsPath: require.resolve('../workflows'),
        activityClasses: [], // Populated by module
        maxConcurrentActivityExecutions: 100,
      },
    };
  }
}

// app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TemporalModule.registerAsync({
      imports: [ConfigModule],
      useClass: TemporalConfigService,
    }),
  ],
})
export class AppModule {}
```

### Alternative Async Pattern (useFactory)

```typescript
TemporalModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    connection: {
      address: configService.get('TEMPORAL_ADDRESS', 'localhost:7233'),
      namespace: configService.get('TEMPORAL_NAMESPACE', 'default'),
    },
    taskQueue: configService.get('TEMPORAL_TASK_QUEUE', 'default'),
    worker: {
      workflowsPath: require.resolve('./workflows'),
      activityClasses: [PaymentActivity, EmailActivity],
    },
  }),
  inject: [ConfigService],
})
```

## TLS Configuration (Temporal Cloud)

For secure connections to Temporal Cloud:

```typescript
import * as fs from 'fs';

TemporalModule.register({
  connection: {
    address: 'your-namespace.your-account.tmprl.cloud:7233',
    namespace: 'your-namespace.your-account',
    tls: {
      clientCertPair: {
        crt: fs.readFileSync('/path/to/client.crt'),
        key: fs.readFileSync('/path/to/client.key'),
      },
    },
  },
  taskQueue: 'my-task-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [PaymentActivity],
  },
})
```

## Configuration Options Reference

```typescript
interface TemporalOptions {
  // Connection settings
  connection: {
    address: string;                    // Temporal server address (default: 'localhost:7233')
    namespace?: string;                 // Temporal namespace (default: 'default')
    tls?: TLSConfig;                   // TLS configuration for secure connections
  };

  // Task queue name
  taskQueue?: string;                   // Default task queue (default: 'default')

  // Worker configuration
  worker?: {
    workflowsPath?: string;             // Path to workflow definitions (use require.resolve)
    activityClasses?: any[];            // Array of activity classes to register
    autoStart?: boolean;                // Auto-start worker on module init (default: true)
    autoRestart?: boolean;              // Auto-restart on failure (inherits from global)
    maxRestarts?: number;               // Max restart attempts (inherits from global)
    maxConcurrentActivityExecutions?: number;  // Max concurrent activities (default: 100)
    maxActivitiesPerSecond?: number;    // Rate limit for activities
  };

  // Logging
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';  // Log level (default: 'info')
  enableLogger?: boolean;               // Enable logging (default: true)

  // Auto-restart configuration
  autoRestart?: boolean;                // Auto-restart worker on failure (default: true)
  maxRestarts?: number;                 // Max restart attempts before giving up (default: 3)

  // Advanced
  isGlobal?: boolean;                   // Make module global (default: false)
}
```

Next: [Core Concepts](./core-concepts.md).
