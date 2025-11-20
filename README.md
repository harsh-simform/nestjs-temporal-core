# NestJS Temporal Core

<div align="center">

A comprehensive NestJS integration framework for Temporal.io that provides enterprise-ready workflow orchestration with automatic discovery, declarative decorators, and robust monitoring capabilities.

![Statements](https://img.shields.io/badge/statements-99.75%25-brightgreen.svg?style=flat)
![Branches](https://img.shields.io/badge/branches-92.05%25-brightgreen.svg?style=flat)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat)
![Lines](https://img.shields.io/badge/lines-99.74%25-brightgreen.svg?style=flat)

[Documentation](https://harsh-simform.github.io/nestjs-temporal-core/) • [NPM](https://www.npmjs.com/package/nestjs-temporal-core) • [GitHub](https://github.com/harsh-simform/nestjs-temporal-core) • [Example Project](https://github.com/harsh-simform/nestjs-temporal-core-example)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Module Variants](#module-variants)
- [Configuration](#configuration)
  - [Basic Configuration](#basic-configuration)
  - [Multiple Workers](#multiple-workers-configuration)
  - [Async Configuration](#async-configuration)
  - [TLS Configuration](#tls-configuration-temporal-cloud)
- [Core Concepts](#core-concepts)
  - [Activities](#activities)
  - [Workflows](#workflows)
  - [Signals and Queries](#signals-and-queries)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Health Monitoring](#health-monitoring)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)
- [License](#license)

## Overview

NestJS Temporal Core bridges NestJS's powerful dependency injection system with Temporal.io's robust workflow orchestration engine. It provides a declarative approach to building distributed, fault-tolerant applications with automatic service discovery, enterprise-grade monitoring, and seamless integration.

### Key Benefits

- 🚀 **Seamless Integration**: Native NestJS decorators and dependency injection
- 🔍 **Auto-Discovery**: Automatic registration of activities via decorators
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🏥 **Enterprise Ready**: Built-in health checks, monitoring, and error handling
- ⚙️ **Zero Configuration**: Smart defaults with extensive customization options
- 📦 **Modular Architecture**: Separate modules for client, worker, activities, and schedules
- 🔄 **Production Grade**: Connection pooling, graceful shutdown, and fault tolerance

[🔝 Back to top](#table-of-contents)

## Features

- ✨ **Declarative Decorators**: `@Activity()` and `@ActivityMethod()` for clean activity definitions
- 🔎 **Automatic Discovery**: Runtime discovery and registration of activities
- 📅 **Schedule Management**: Programmatic schedule creation and management
- 🏥 **Health Monitoring**: Built-in health checks and status reporting
- 🔌 **Connection Management**: Automatic connection pooling and lifecycle management
- 🛠️ **Error Handling**: Comprehensive error handling with structured logging
- 📊 **Performance Monitoring**: Built-in metrics and performance tracking
- 🔚 **Graceful Shutdown**: Clean resource cleanup and connection termination
- 📦 **Modular Design**: Use only what you need (client-only, worker-only, etc.)
- 🔄 **Multiple Workers**: Support for multiple workers with different task queues

[🔝 Back to top](#table-of-contents)

## Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/common
```

### Peer Dependencies

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

[🔝 Back to top](#table-of-contents)

## Quick Start

### 1. Enable Shutdown Hooks

Enable shutdown hooks in your `main.ts` for proper Temporal resource cleanup:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Required for graceful Temporal connection cleanup
  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
```

### 2. Configure the Module

Import and configure `TemporalModule` in your app module:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { PaymentActivity } from './activities/payment.activity';
import { EmailActivity } from './activities/email.activity';

@Module({
  imports: [
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
      },
    }),
  ],
  providers: [PaymentActivity, EmailActivity],
})
export class AppModule {}
```

### 3. Define Activities

Create activities using `@Activity()` and `@ActivityMethod()` decorators:

```typescript
// payment.activity.ts
import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

export interface PaymentData {
  amount: number;
  currency: string;
  customerId: string;
}

@Injectable()
@Activity({ name: 'payment-activities' })
export class PaymentActivity {

  @ActivityMethod('processPayment')
  async processPayment(data: PaymentData): Promise<{ transactionId: string }> {
    // Payment processing logic with full NestJS DI support
    console.log(`Processing payment: $${data.amount} ${data.currency}`);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { transactionId: `txn_${Date.now()}` };
  }

  @ActivityMethod('refundPayment')
  async refundPayment(transactionId: string): Promise<{ refundId: string }> {
    // Refund logic
    console.log(`Refunding transaction: ${transactionId}`);
    return { refundId: `ref_${Date.now()}` };
  }
}
```

### 4. Define Workflows

Create workflows as pure Temporal functions (NOT NestJS services):

```typescript
// payment.workflow.ts
import { proxyActivities, defineSignal, defineQuery, setHandler } from '@temporalio/workflow';
import type { PaymentActivity } from './payment.activity';

// Create activity proxies
const { processPayment, refundPayment } = proxyActivities<typeof PaymentActivity.prototype>({
  startToCloseTimeout: '5m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
  },
});

// Define signals and queries
export const cancelPaymentSignal = defineSignal<[string]>('cancelPayment');
export const getPaymentStatusQuery = defineQuery<string>('getPaymentStatus');

export async function processPaymentWorkflow(data: PaymentData): Promise<any> {
  let status = 'processing';
  let transactionId: string | undefined;

  // Set up signal and query handlers
  setHandler(cancelPaymentSignal, (reason: string) => {
    status = 'cancelled';
  });

  setHandler(getPaymentStatusQuery, () => status);

  try {
    // Execute payment activity
    const result = await processPayment(data);
    transactionId = result.transactionId;
    status = 'completed';

    return {
      success: true,
      transactionId,
      status,
    };
  } catch (error) {
    status = 'failed';

    // Compensate if needed
    if (transactionId) {
      await refundPayment(transactionId);
    }

    throw error;
  }
}
```

### 5. Use in Services

Inject `TemporalService` to start and manage workflows:

```typescript
// payment.service.ts
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class PaymentService {
  constructor(private readonly temporal: TemporalService) {}

  async processPayment(paymentData: any) {
    // Start workflow
    const result = await this.temporal.startWorkflow(
      'processPaymentWorkflow',
      [paymentData],
      {
        workflowId: `payment-${Date.now()}`,
        taskQueue: 'my-task-queue',
      }
    );

    return {
      workflowId: result.result.workflowId,
      runId: result.result.runId,
    };
  }

  async checkPaymentStatus(workflowId: string) {
    // Query workflow
    const statusResult = await this.temporal.queryWorkflow(
      workflowId,
      'getPaymentStatus'
    );

    return { status: statusResult.result };
  }

  async cancelPayment(workflowId: string, reason: string) {
    // Send signal
    await this.temporal.signalWorkflow(
      workflowId,
      'cancelPayment',
      [reason]
    );
  }
}
```

[🔝 Back to top](#table-of-contents)

## Module Variants

The package provides modular architecture with separate modules for different use cases:

### 1. Unified Module (Recommended)

Complete integration with both client and worker capabilities:

```typescript
import { TemporalModule } from 'nestjs-temporal-core';

TemporalModule.register({
  connection: { address: 'localhost:7233' },
  taskQueue: 'my-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [PaymentActivity, EmailActivity],
  },
})
```

### 2. Client-Only Module

For services that only need to start/query workflows:

```typescript
import { TemporalClientModule } from 'nestjs-temporal-core/client';

TemporalClientModule.register({
  connection: { address: 'localhost:7233' },
  namespace: 'default',
})
```

### 3. Worker-Only Module

For dedicated worker processes:

```typescript
import { TemporalWorkerModule } from 'nestjs-temporal-core/worker';

TemporalWorkerModule.register({
  connection: { address: 'localhost:7233' },
  taskQueue: 'worker-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [BackgroundActivity],
  },
})
```

### 4. Activity-Only Module

For standalone activity management:

```typescript
import { TemporalActivityModule } from 'nestjs-temporal-core/activity';

TemporalActivityModule.register({
  activityClasses: [DataProcessingActivity],
})
```

### 5. Schedules-Only Module

For managing Temporal schedules:

```typescript
import { TemporalSchedulesModule } from 'nestjs-temporal-core/schedules';

TemporalSchedulesModule.register({
  connection: { address: 'localhost:7233' },
})
```

[🔝 Back to top](#table-of-contents)

## Configuration

### Basic Configuration

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

### Multiple Workers Configuration

**New in 3.0.12**: Support for multiple workers with different task queues in the same process.

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    namespace: 'default',
  },
  workers: [
    {
      taskQueue: 'payments-queue',
      workflowsPath: require.resolve('./workflows/payments'),
      activityClasses: [PaymentActivity, RefundActivity],
      autoStart: true,
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
      autoStart: false, // Start manually later
    },
  ],
  logLevel: 'info',
  enableLogger: true,
})
```

#### Accessing Multiple Workers

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

### Manual Worker Creation (Advanced)

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

### Async Configuration

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

### TLS Configuration (Temporal Cloud)

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

### Configuration Options Reference

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
    maxConcurrentActivityExecutions?: number;  // Max concurrent activities (default: 100)
    maxActivitiesPerSecond?: number;    // Rate limit for activities
  };

  // Logging
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';  // Log level (default: 'info')
  enableLogger?: boolean;               // Enable logging (default: true)

  // Advanced
  isGlobal?: boolean;                   // Make module global (default: false)
  autoRestart?: boolean;                // Auto-restart worker on failure (default: true)
}
```

[🔝 Back to top](#table-of-contents)

## Core Concepts

### Activities

Activities are NestJS services decorated with `@Activity()` that perform actual work. They have full access to NestJS dependency injection and can interact with external systems.

**Key Points:**
- Activities are NestJS services (`@Injectable()`)
- Use `@Activity()` decorator at class level
- Use `@ActivityMethod()` decorator for methods to be registered
- Activities should be idempotent and handle retries gracefully
- Full access to NestJS DI (inject services, repositories, etc.)

```typescript
@Injectable()
@Activity({ name: 'order-activities' })
export class OrderActivity {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly emailService: EmailService,
  ) {}

  @ActivityMethod('createOrder')
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // Database operations with full DI support
    const order = await this.orderRepository.create(orderData);
    await this.emailService.sendConfirmation(order);
    return order;
  }

  @ActivityMethod('validateInventory')
  async validateInventory(items: OrderItem[]): Promise<boolean> {
    // Business logic with injected services
    return await this.orderRepository.checkInventory(items);
  }
}
```

### Workflows

Workflows are **pure Temporal functions** (NOT NestJS services) that orchestrate activities. They must be deterministic and use Temporal's workflow APIs.

**Important:** Workflows are NOT decorated with `@Injectable()` and should NOT use NestJS dependency injection.

```typescript
// order.workflow.ts
import { proxyActivities, defineSignal, defineQuery, setHandler } from '@temporalio/workflow';
import type { OrderActivity } from './order.activity';

// Create activity proxies with proper typing
const { createOrder, validateInventory } = proxyActivities<typeof OrderActivity.prototype>({
  startToCloseTimeout: '5m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    maximumInterval: '30s',
  },
});

// Define signals and queries at module level
export const cancelOrderSignal = defineSignal<[string]>('cancelOrder');
export const getOrderStatusQuery = defineQuery<string>('getOrderStatus');

// Workflow function (exported, not a class)
export async function processOrderWorkflow(orderData: CreateOrderData): Promise<OrderResult> {
  let status = 'pending';

  // Set up signal handler
  setHandler(cancelOrderSignal, (reason: string) => {
    status = 'cancelled';
  });

  // Set up query handler
  setHandler(getOrderStatusQuery, () => status);

  try {
    // Validate inventory
    const isValid = await validateInventory(orderData.items);
    if (!isValid) {
      throw new Error('Insufficient inventory');
    }

    // Create order
    status = 'processing';
    const order = await createOrder(orderData);
    status = 'completed';

    return {
      orderId: order.id,
      status,
    };
  } catch (error) {
    status = 'failed';
    throw error;
  }
}
```

### Signals and Queries

Signals allow external systems to send events to workflows, while queries provide read-only access to workflow state.

```typescript
import { defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';

// Define at module level
export const updateStatusSignal = defineSignal<[string]>('updateStatus');
export const addItemSignal = defineSignal<[Item]>('addItem');
export const getItemsQuery = defineQuery<Item[]>('getItems');
export const getStatusQuery = defineQuery<string>('getStatus');

export async function myWorkflow(): Promise<void> {
  let status = 'pending';
  const items: Item[] = [];

  // Set up handlers
  setHandler(updateStatusSignal, (newStatus: string) => {
    status = newStatus;
  });

  setHandler(addItemSignal, (item: Item) => {
    items.push(item);
  });

  setHandler(getItemsQuery, () => items);
  setHandler(getStatusQuery, () => status);

  // Wait for completion signal
  await condition(() => status === 'completed');
}
```

### Using Workflows in Services

Inject `TemporalService` in your NestJS services to interact with workflows:

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly temporal: TemporalService) {}

  async createOrder(orderData: CreateOrderData) {
    // Start workflow - note the method signature
    const result = await this.temporal.startWorkflow(
      'processOrderWorkflow',           // Workflow function name
      [orderData],                      // Arguments array
      {                                 // Options
        workflowId: `order-${Date.now()}`,
        taskQueue: 'order-queue',
      }
    );

    return {
      workflowId: result.result.workflowId,
      runId: result.result.runId,
    };
  }

  async queryOrderStatus(workflowId: string) {
    const result = await this.temporal.queryWorkflow(
      workflowId,
      'getOrderStatus'
    );

    return result.result;
  }

  async cancelOrder(workflowId: string, reason: string) {
    await this.temporal.signalWorkflow(
      workflowId,
      'cancelOrder',
      [reason]
    );
  }
}
```

[🔝 Back to top](#table-of-contents)

## API Reference

For detailed API documentation, visit the [Full API Documentation](https://harsh-simform.github.io/nestjs-temporal-core/).

### TemporalService

The main unified service providing access to all Temporal functionality. See the [API Documentation](https://harsh-simform.github.io/nestjs-temporal-core/) for complete method signatures and examples.

Key methods:
- `startWorkflow()` - Start a workflow execution
- `signalWorkflow()` - Send a signal to a running workflow
- `queryWorkflow()` - Query a running workflow
- `getWorkflowHandle()` - Get a workflow handle to interact with it
- `terminateWorkflow()` - Terminate a workflow execution
- `cancelWorkflow()` - Cancel a workflow execution
- `getHealth()` - Get service health status
- `createSchedule()` - Create a schedule
- `listSchedules()` - List all schedules
- `deleteSchedule()` - Delete a schedule

[🔝 Back to top](#table-of-contents)

## Examples

### 🚀 Example Project

Check out our **[complete example repository](https://github.com/harsh-simform/nestjs-temporal-core-example)** featuring:

- ✅ **Real-world implementations** - Production-ready examples
- ✅ **Multiple use cases** - E-commerce, notifications, reports, and more
- ✅ **Best practices** - Following all recommended patterns
- ✅ **Docker setup** - Ready-to-run with docker-compose
- ✅ **Test coverage** - Comprehensive test examples

### 📚 Documentation Examples

For more examples, visit our [documentation](https://harsh-simform.github.io/nestjs-temporal-core/). Key example scenarios include:

1. **E-commerce Order Processing** - Complete example with compensation logic
2. **Scheduled Reports** - Creating and managing scheduled workflows
3. **Activity Retry Configuration** - Custom retry policies
4. **Child Workflows** - Organizing complex workflows
5. **Continue-As-New** - For long-running workflows
6. **Custom Error Handling** - Implementing custom error types

[🔝 Back to top](#table-of-contents)

## Advanced Usage

### Activity Retry Configuration

```typescript
// workflow.ts
const paymentActivities = proxyActivities<typeof PaymentActivity.prototype>({
  startToCloseTimeout: '5m',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1s',
    maximumInterval: '1m',
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ['InvalidPaymentMethod', 'InsufficientFunds'],
  },
});
```

### Workflow Testing

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { processOrderWorkflow } from './order.workflow';

describe('Order Workflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should process order successfully', async () => {
    const { client, nativeConnection } = testEnv;

    // Mock activities
    const mockOrderActivity = {
      validatePayment: async () => ({ valid: true }),
      reserveInventory: async () => ({ reservationId: 'res-123' }),
      chargePayment: async () => ({ transactionId: 'txn-123' }),
      sendConfirmationEmail: async () => {},
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test',
      workflowsPath: require.resolve('./order.workflow'),
      activities: mockOrderActivity,
    });

    await worker.runUntil(async () => {
      const result = await client.workflow.execute(processOrderWorkflow, {
        workflowId: 'test-order-1',
        taskQueue: 'test',
        args: [{
          orderId: 'order-123',
          payment: { amount: 100, currency: 'USD' },
          items: [{ id: '1', quantity: 1 }],
        }],
      });

      expect(result.status).toBe('completed');
      expect(result.transactionId).toBe('txn-123');
    });
  });
});
```

[🔝 Back to top](#table-of-contents)

## Best Practices

### 1. Workflow Design

**✅ DO:**
- Keep workflows deterministic (no random numbers, current time, network calls)
- Use activities for any non-deterministic operations
- Keep workflow history size manageable (use continue-as-new for long-running workflows)
- Export workflow functions (not classes)
- Use `defineSignal` and `defineQuery` at module level

**❌ DON'T:**
- Don't use `@Injectable()` on workflow functions
- Don't inject NestJS services in workflows
- Don't use `Math.random()` or `Date.now()` directly in workflows
- Don't make HTTP calls or database queries directly in workflows

### 2. Activity Design

**✅ DO:**
- Make activities idempotent (safe to retry)
- Use `@Injectable()` and leverage NestJS DI
- Use `@Activity()` and `@ActivityMethod()` decorators
- Handle errors appropriately
- Log activity execution for debugging

**❌ DON'T:**
- Don't make activities too granular (network overhead)
- Don't rely on activity execution order guarantees
- Don't share mutable state between activity invocations

### 3. Configuration

**✅ DO:**
- Use async configuration for environment-based setup
- Configure appropriate timeouts for your use case
- Set up proper retry policies
- Enable graceful shutdown hooks
- Use task queues to organize work

**❌ DON'T:**
- Don't hardcode connection strings
- Don't use the same task queue for all workflows
- Don't ignore timeout configurations

### 4. Error Handling

**✅ DO:**
- Implement compensation logic in workflows
- Use appropriate retry policies
- Log errors with context
- Define non-retryable error types
- Handle activity failures gracefully

**❌ DON'T:**
- Don't swallow errors silently
- Don't retry indefinitely
- Don't ignore business-level failures

### 5. Testing

**✅ DO:**
- Write unit tests for activities
- Use TestWorkflowEnvironment for integration tests
- Mock external dependencies
- Test failure scenarios
- Test signal and query handlers

**❌ DON'T:**
- Don't skip workflow testing
- Don't test against production Temporal server
- Don't assume workflows are correct without testing

[🔝 Back to top](#table-of-contents)

## Health Monitoring

The package includes comprehensive health monitoring capabilities for production deployments.

### Using Built-in Health Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { TemporalHealthModule } from 'nestjs-temporal-core/health';

@Module({
  imports: [
    TemporalModule.register({
      connection: { address: 'localhost:7233' },
      taskQueue: 'my-queue',
      worker: {
        workflowsPath: require.resolve('./workflows'),
        activityClasses: [MyActivity],
      },
    }),
    TemporalHealthModule, // Adds /health/temporal endpoint
  ],
})
export class AppModule {}
```

### Custom Health Checks

```typescript
@Controller('health')
export class HealthController {
  constructor(private readonly temporal: TemporalService) {}

  @Get('/status')
  async getHealthStatus() {
    const health = this.temporal.getHealth();

    return {
      status: health.overallHealth,
      timestamp: new Date(),
      services: {
        client: {
          healthy: health.client.status === 'healthy',
          connection: health.client.connectionStatus,
        },
        worker: {
          healthy: health.worker.status === 'healthy',
          state: health.worker.state,
          activitiesRegistered: health.worker.activitiesCount,
        },
        discovery: {
          healthy: health.discovery.status === 'healthy',
          activitiesDiscovered: health.discovery.activitiesDiscovered,
        },
      },
      uptime: health.uptime,
    };
  }
}
```

[🔝 Back to top](#table-of-contents)

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Errors

**Problem:** Cannot connect to Temporal server

**Solutions:**
```typescript
// Check connection configuration
const health = temporalService.getHealth();
console.log('Connection status:', health.client.connectionStatus);

// Verify Temporal server is running
// docker ps | grep temporal

// Check connection settings
TemporalModule.register({
  connection: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: 'default',
  },
})
```

#### 2. Activity Not Found

**Problem:** Workflow cannot find registered activities

**Solutions:**
```typescript
// 1. Ensure activity is in activityClasses array
TemporalModule.register({
  worker: {
    activityClasses: [MyActivity], // Must include the activity class
  },
})

// 2. Verify activity is registered as provider
@Module({
  providers: [MyActivity], // Must be in providers array
})

// 3. Check activity decorator
@Activity({ name: 'my-activities' })
export class MyActivity {
  @ActivityMethod('myActivity')
  async myActivity() { }
}

// 4. Check discovery status
const health = temporalService.getHealth();
console.log('Activities discovered:', health.discovery.activitiesDiscovered);
```

#### 3. Workflow Registration Issues

**Problem:** Workflow not found or not executing

**Solutions:**
```typescript
// 1. Ensure workflowsPath is correct
TemporalModule.register({
  worker: {
    workflowsPath: require.resolve('./workflows'), // Must resolve to workflows file/directory
  },
})

// 2. Export workflow function properly
// workflows/index.ts
export { processOrderWorkflow } from './order.workflow';
export { reportWorkflow } from './report.workflow';

// 3. Use correct workflow name when starting
await temporal.startWorkflow(
  'processOrderWorkflow', // Must match exported function name
  [args],
  options
);
```

#### 4. Timeout Issues

**Problem:** Activities or workflows timing out

**Solutions:**
```typescript
// Configure appropriate timeouts
const activities = proxyActivities<typeof MyActivity.prototype>({
  startToCloseTimeout: '10m',    // Increase for long-running activities
  scheduleToCloseTimeout: '15m', // Total time including queuing
  scheduleToStartTimeout: '5m',  // Time waiting in queue
});

// For workflows
await temporal.startWorkflow('myWorkflow', [args], {
  workflowExecutionTimeout: '24h', // Max total execution time
  workflowRunTimeout: '12h',       // Max single run time
  workflowTaskTimeout: '10s',      // Decision task timeout
});
```

### Debug Mode

Enable comprehensive debugging:

```typescript
TemporalModule.register({
  logLevel: 'debug',
  enableLogger: true,
  connection: {
    address: 'localhost:7233',
  },
  worker: {
    debugMode: true, // If available
  },
})

// Check detailed health and statistics
const health = temporalService.getHealth();
const stats = temporalService.getStatistics();
console.log('Health:', JSON.stringify(health, null, 2));
console.log('Stats:', JSON.stringify(stats, null, 2));
```

### Getting Help

If you're still experiencing issues:

1. **Check the logs** - Enable debug logging to see detailed information
2. **Verify configuration** - Double-check all connection and worker settings
3. **Test connectivity** - Ensure Temporal server is accessible
4. **Review health status** - Use `getHealth()` to identify failing components
5. **Check GitHub Issues** - [Search existing issues](https://github.com/harsh-simform/nestjs-temporal-core/issues)
6. **Create an issue** - Provide logs, configuration, and minimal reproduction

[🔝 Back to top](#table-of-contents)

## Migration Guide

### Migrating to v3.0.12+ (Multiple Workers Support)

Version 3.0.12 introduces support for multiple workers without breaking existing single-worker configurations.

#### No Changes Required for Single Worker

Your existing configuration continues to work:

```typescript
// ✅ This still works exactly as before
TemporalModule.register({
  connection: { address: 'localhost:7233' },
  taskQueue: 'my-queue',
  worker: {
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [MyActivity],
  },
})
```

#### Migrating to Multiple Workers

**After (v3.0.12):**
```typescript
// Option 1: Configure multiple workers in module
TemporalModule.register({
  connection: { address: 'localhost:7233' },
  workers: [
    {
      taskQueue: 'main-queue',
      workflowsPath: require.resolve('./workflows/main'),
      activityClasses: [MainActivity],
    },
    {
      taskQueue: 'schedule-queue',
      workflowsPath: require.resolve('./workflows/schedule'),
      activityClasses: [ScheduleActivity],
    },
  ],
})
```

#### New APIs in v3.0.12

```typescript
// Get native connection for custom worker creation
const workerManager = temporal.getWorkerManager();
const connection: NativeConnection | null = workerManager.getConnection();

// Get specific worker by task queue
const worker: Worker | null = temporal.getWorker('payments-queue');

// Get all workers information
const workersInfo: MultipleWorkersInfo = temporal.getAllWorkers();
console.log(`${workersInfo.runningWorkers}/${workersInfo.totalWorkers} workers running`);

// Control specific workers
await temporal.startWorkerByTaskQueue('payments-queue');
await temporal.stopWorkerByTaskQueue('notifications-queue');

// Register new worker dynamically
const result = await temporal.registerWorker({
  taskQueue: 'new-queue',
  workflowsPath: require.resolve('./workflows/new'),
  activityClasses: [NewActivity],
  autoStart: true,
});
```

[🔝 Back to top](#table-of-contents)

## Requirements

- **Node.js**: >= 16.0.0
- **NestJS**: >= 9.0.0
- **Temporal Server**: >= 1.20.0

## Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/harsh-simform/nestjs-temporal-core.git
cd nestjs-temporal-core

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:cov

# Build the package
npm run build

# Generate documentation
npm run docs:generate
```

[🔝 Back to top](#table-of-contents)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support and Resources

- 📚 **Documentation**: [Full API Documentation](https://harsh-simform.github.io/nestjs-temporal-core/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/harsh-simform/nestjs-temporal-core/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/harsh-simform/nestjs-temporal-core/discussions)
- 📦 **NPM**: [nestjs-temporal-core](https://www.npmjs.com/package/nestjs-temporal-core)
- 🔄 **Changelog**: [Releases](https://github.com/harsh-simform/nestjs-temporal-core/releases)
- 📖 **Example Project**: [nestjs-temporal-core-example](https://github.com/harsh-simform/nestjs-temporal-core-example)

## Related Projects

- [Temporal.io](https://temporal.io/) - The underlying workflow orchestration platform
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [@temporalio/sdk](https://www.npmjs.com/package/@temporalio/client) - Official Temporal TypeScript SDK

---

<div align="center">

**[⭐ Star us on GitHub](https://github.com/harsh-simform/nestjs-temporal-core)** if you find this project helpful!

Made with ❤️ by the Harsh Simform

</div>
