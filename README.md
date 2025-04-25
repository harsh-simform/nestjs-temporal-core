# NestJS Temporal Core

A robust NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless worker and client support for building reliable distributed applications.

## Overview

NestJS Temporal Core simplifies building fault-tolerant, long-running processes in your NestJS applications by integrating with Temporal.io - a durable execution system for reliable microservices and workflow orchestration.

## Features

- 🚀 **Easy NestJS Integration** - Register modules with sync/async configuration
- 🔄 **Complete Lifecycle Management** - Automatic worker initialization and graceful shutdown
- 🎯 **Declarative Decorators** - Type-safe `@Activity()`, `@Workflow()`, `@Signal()`, and `@Query()` decorators
- 🔌 **Connection Management** - Built-in connection handling with TLS support
- 🔒 **Type Safety** - Strongly typed interfaces for all Temporal concepts
- 📡 **Client Operation Utilities** - Methods for starting, signaling, querying and managing workflows
- 📊 **Monitoring Support** - Worker status tracking and metrics
- 📅 **Scheduling** - Native support for cron and interval-based workflow scheduling
- 🔍 **Queries and Signals** - First-class support for Temporal's query and signal patterns
- 🚦 **Advanced Policies** - Built-in retry, timeout, and workflow management policies

## Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow
```

## Quick Start

### 1. Enable Shutdown Hooks

First, make sure to enable shutdown hooks in your `main.ts` file:

```typescript
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();
    await app.listen(3000);
}
bootstrap();
```

### 2. Register the Modules

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
            autoStart: {
                enabled: true,
                delayMs: 1000, // Start worker after 1 second
            },
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

### 3. Define Activities

```typescript
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

@Activity({
    name: 'PaymentActivities', // Optional custom name
    description: 'Activities for payment processing',
})
export class PaymentActivity {
    @ActivityMethod({
        name: 'processPayment', // Optional custom name
        timeout: {
            startToClose: '30s',
        },
    })
    async processPayment(amount: number): Promise<string> {
        // Implementation
        return 'payment-id';
    }

    @ActivityMethod()
    async refundPayment(paymentId: string): Promise<boolean> {
        // Implementation
        return true;
    }
}
```

### 4. Define Workflows

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type { PaymentActivity } from './payment.activity';

// Reference activities in your workflow
const { processPayment, refundPayment } = proxyActivities<PaymentActivity>({
    startToCloseTimeout: '30 seconds',
});

export async function paymentWorkflow(amount: number): Promise<string> {
    return await processPayment(amount);
}

export async function refundWorkflow(paymentId: string): Promise<boolean> {
    return await refundPayment(paymentId);
}
```

### 5. Use the Client Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalClientService } from 'nestjs-temporal-core';

@Injectable()
export class PaymentService {
    constructor(private readonly temporalClient: TemporalClientService) {}

    async initiatePayment(amount: number) {
        const { result, workflowId } = await this.temporalClient.startWorkflow<string, [number]>(
            'paymentWorkflow',
            [amount],
            {
                taskQueue: 'my-task-queue',
                workflowExecutionTimeout: '1h',
                workflowTaskTimeout: '10s',
                retry: {
                    maximumAttempts: 3,
                },
            },
        );

        // Wait for the workflow to complete
        const paymentId = await result;

        return { paymentId, workflowId };
    }

    async checkPaymentStatus(workflowId: string) {
        // Query a running workflow
        return await this.temporalClient.queryWorkflow<string>(workflowId, 'getPaymentStatus');
    }

    async cancelPayment(workflowId: string, reason: string) {
        // Signal a running workflow
        await this.temporalClient.signalWorkflow(workflowId, 'cancelPayment', [reason]);
    }
}
```

## Advanced Features

### Class-Based Workflows with Queries and Signals

```typescript
import { Workflow, WorkflowMethod, Query, Signal } from 'nestjs-temporal-core';

@Workflow({
    taskQueue: 'order-queue',
    workflowIdPrefix: 'order-',
    workflowExecutionTimeout: '24h',
})
export class OrderWorkflow {
    private orderStatus: string = 'PENDING';
    private cancelReason: string | null = null;

    @WorkflowMethod()
    async execute(orderId: string): Promise<string> {
        // Workflow implementation
        return this.orderStatus;
    }

    @Query()
    getStatus(): string {
        return this.orderStatus;
    }

    @Signal()
    cancel(reason: string): void {
        this.orderStatus = 'CANCELLED';
        this.cancelReason = reason;
    }
}
```

### Scheduled Workflows

```typescript
import { ScheduledWorkflow, WorkflowMethod } from 'nestjs-temporal-core';

@ScheduledWorkflow({
    taskQueue: 'scheduled-tasks',
    schedule: {
        cron: '0 0 * * *', // Run daily at midnight
    },
    description: 'Daily reporting workflow',
})
export class DailyReportWorkflow {
    @WorkflowMethod()
    async execute(): Promise<void> {
        // Generate and send reports
    }
}
```

### Using the Schedule Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalScheduleService } from 'nestjs-temporal-core';

@Injectable()
export class ReportingService {
    constructor(private readonly scheduleService: TemporalScheduleService) {}

    async createDailyReportSchedule() {
        return await this.scheduleService.createCronWorkflow(
            'daily-sales-report',
            'generateSalesReport',
            '0 0 * * *', // Daily at midnight
            'reports-queue',
            [], // No arguments
            'Daily sales report generation',
        );
    }

    async createHourlyDataBackup() {
        return await this.scheduleService.createIntervalWorkflow(
            'hourly-data-backup',
            'backupData',
            { hours: 1 },
            'backup-queue',
            [],
            'Hourly data backup process',
        );
    }

    async pauseReports() {
        await this.scheduleService.pauseSchedule(
            'daily-sales-report',
            'Paused for system maintenance',
        );
    }

    async listAllSchedules() {
        return await this.scheduleService.listSchedules();
    }
}
```

## Advanced Configuration

### Async Configuration

Use factory patterns for dynamic configuration:

```typescript
TemporalWorkerModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => ({
        connection: {
            address: configService.get('TEMPORAL_ADDRESS'),
            connectionTimeout: configService.get('TEMPORAL_CONNECTION_TIMEOUT', 5000),
        },
        namespace: configService.get('TEMPORAL_NAMESPACE'),
        taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
        workflowsPath: require.resolve('./workflows'),
        activityClasses: [MyActivity],
        autoStart: {
            enabled: configService.get('TEMPORAL_WORKER_AUTOSTART', true),
            delayMs: configService.get('TEMPORAL_WORKER_START_DELAY', 0),
        },
        allowWorkerFailure: configService.get('TEMPORAL_ALLOW_WORKER_FAILURE', true),
    }),
    inject: [ConfigService],
});
```

### TLS Configuration

Set up secure communications with TLS:

```typescript
TemporalClientModule.register({
    connection: {
        address: 'temporal.example.com:7233',
        tls: {
            clientCertPair: {
                crt: Buffer.from('...'),
                key: Buffer.from('...'),
                ca: Buffer.from('...'), // Optional CA certificate
            },
            serverName: 'temporal.example.com', // Optional for SNI
            verifyServer: true, // Optional, defaults to true
        },
        connectionTimeout: 10000, // 10 seconds
    },
    namespace: 'production',
    allowConnectionFailure: true, // Allow application to start if Temporal connection fails
});
```

### Worker Monitoring

Enable worker monitoring and metrics:

```typescript
TemporalWorkerModule.register({
    // ... other options
    monitoring: {
        statsIntervalMs: 60000, // Log stats every minute
        metrics: {
            enabled: true,
            prometheus: {
                enabled: true,
                port: 9464,
            },
        },
    },
});
```

## API Reference

### Core Modules

- `TemporalClientModule` - Client connectivity for workflow operations
- `TemporalWorkerModule` - Worker process for running activities
- `TemporalScheduleModule` - Scheduling for recurring workflows

### Decorators

- `@Activity(options?)` - Marks a class as a Temporal activity
- `@ActivityMethod(options?)` - Marks a method as an activity implementation
- `@Workflow(options)` - Marks a class as a Temporal workflow
- `@WorkflowMethod(options?)` - Marks the primary workflow execution method
- `@Query(options?)` - Marks a method as a query handler
- `@Signal(options?)` - Marks a method as a signal handler
- `@ScheduledWorkflow(options)` - Defines a workflow with schedule configuration

### Services

#### TemporalClientService

- `startWorkflow<T, A>()` - Start a new workflow execution
- `signalWorkflow()` - Send a signal to a running workflow
- `queryWorkflow<T>()` - Query a running workflow
- `terminateWorkflow()` - Terminate a running workflow
- `cancelWorkflow()` - Request cancellation of a workflow
- `getWorkflowHandle()` - Get a handle to manage a workflow
- `describeWorkflow()` - Get workflow execution details
- `getWorkflowClient()` - Get the underlying workflow client

#### TemporalScheduleService

- `createCronWorkflow()` - Create a workflow scheduled by cron expression
- `createIntervalWorkflow()` - Create a workflow scheduled by time interval
- `pauseSchedule()` - Pause a schedule
- `resumeSchedule()` - Resume a paused schedule
- `deleteSchedule()` - Delete a schedule
- `triggerNow()` - Trigger an immediate execution
- `backfill()` - Run schedule actions for a past time range
- `listSchedules()` - List all schedules
- `describeSchedule()` - Get detailed schedule information

#### WorkerManager

- `startWorker()` - Manually start the worker
- `shutdown()` - Gracefully shutdown the worker
- `getWorker()` - Get the underlying worker instance

## Error Handling

The module includes comprehensive error handling:

- Worker initialization errors are logged and handled based on configuration
- Client operations include detailed error messages and proper error propagation
- Activities and workflow errors are properly captured and logged
- Connection errors are handled gracefully with automatic cleanup
- Configurable failure modes for both client and worker connections

## Best Practices

1. **Activity Design**

    - Define activity interfaces for type safety
    - Keep activities focused on single responsibilities
    - Set appropriate timeouts for expected durations

2. **Workflow Design**

    - Make workflows deterministic
    - Use signals for external events
    - Use queries for retrieving workflow state
    - Avoid side effects in workflow code

3. **Configuration**

    - Use meaningful workflow IDs for tracking
    - Configure appropriate timeouts for activities and workflows
    - Use retry policies for transient failures
    - Set up monitoring for production deployments

4. **Lifecycle Management**

    - Enable NestJS shutdown hooks
    - Configure proper worker shutdown grace periods
    - Use the WorkerManager service for controlling worker lifecycle

5. **Security**
    - Implement proper TLS security for production environments
    - Use namespaces to isolate different environments

## Contributing

Contributions are welcome! Please see our [contributing guidelines](CONTRIBUTING.md) for details.

## License

MIT

## Author

Harsh M
