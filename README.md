# NestJS Temporal Core

A NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless worker and client support for building reliable distributed applications.

## Features

- 🚀 Easy integration with NestJS modules
- 🔄 Automatic worker initialization and shutdown
- 🎯 Declarative activity decorators
- 🔌 Built-in connection management
- 🛡️ Type-safe workflow execution
- 📡 Simplified client operations

## Example Repository

Check out our [example repository](https://github.com/harsh-simform/nestjs-temporal-core-example) to see a complete working implementation.

## Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { TemporalWorkerModule, TemporalClientModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalWorkerModule.register({
      connection: {
        address: 'localhost:7233',
      },
      namespace: 'default',
      taskQueue: 'my-task-queue',
      workflowsPath: require.resolve('./workflows'),
      activityClasses: [MyActivity],
    }),
    TemporalClientModule.register({
      connection: {
        address: 'localhost:7233',
      },
      namespace: 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Define Activities

```typescript
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

@Activity()
export class PaymentActivity {
  @ActivityMethod()
  async processPayment(amount: number): Promise<string> {
    // Implementation
    return 'payment-id';
  }
}
```

### 3. Define Workflows

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type { PaymentActivity } from './payment.activity';

const { processPayment } = proxyActivities<PaymentActivity>({
  startToCloseTimeout: '30 seconds',
});

export async function paymentWorkflow(amount: number): Promise<string> {
  return await processPayment(amount);
}
```

### 4. Use the Client Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalClientService } from 'nestjs-temporal-core';

@Injectable()
export class PaymentService {
  constructor(private readonly temporalClient: TemporalClientService) {}

  async initiatePayment(amount: number) {
    const { result } = await this.temporalClient.startWorkflow<string, [number]>(
      'paymentWorkflow',
      [amount],
      {
        taskQueue: 'my-task-queue',
      },
    );
    return result;
  }
}
```

## Advanced Configuration

### Async Configuration

```typescript
TemporalWorkerModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    connection: {
      address: configService.get('TEMPORAL_ADDRESS'),
    },
    namespace: configService.get('TEMPORAL_NAMESPACE'),
    taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [MyActivity],
  }),
  inject: [ConfigService],
});
```

### TLS Configuration

```typescript
TemporalClientModule.register({
  connection: {
    address: 'temporal.example.com:7233',
    tls: {
      clientCertPair: {
        crt: Buffer.from('...'),
        key: Buffer.from('...'),
      },
    },
  },
  namespace: 'production',
});
```

## API Reference

### Decorators

- `@Activity()`: Marks a class as a Temporal activity
- `@ActivityMethod()`: Marks a method as a Temporal activity implementation
- `@Workflow()`: Marks a class as a Temporal workflow
- `@InjectTemporalClient()`: Injects the Temporal client instance

### Services

#### TemporalClientService

- `startWorkflow<T, A>()`: Start a new workflow execution
- `signalWorkflow()`: Send a signal to a running workflow
- `terminateWorkflow()`: Terminate a running workflow
- `getWorkflowHandle()`: Get a handle to manage a workflow

### Module Options

#### TemporalWorkerOptions

```typescript
interface TemporalWorkerOptions {
  connection: NativeConnectionOptions;
  namespace: string;
  taskQueue: string;
  workflowsPath: string;
  activityClasses?: Array<new (...args: any[]) => any>;
  runtimeOptions?: RuntimeOptions;
}
```

#### TemporalClientOptions

```typescript
interface TemporalClientOptions {
  connection: ConnectionOptions;
  namespace?: string;
}
```

## Error Handling

The module provides built-in error handling and logging. Worker and client errors are logged using NestJS's built-in logger.

## Health Checks

The WorkerManager provides a `getStatus()` method to check the worker's health:

```typescript
const status = await workerManager.getStatus();
// Returns: { isRunning: boolean; isInitializing: boolean; error: Error | null }
```

## Best Practices

1. Always define activity interfaces for type safety
2. Use meaningful workflow IDs for tracking
3. Implement proper error handling in activities
4. Set appropriate timeouts for activities and workflows
5. Use signals for long-running workflow coordination

## Contributing

Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md) for details.

## License

MIT

## Author

Harsh M
