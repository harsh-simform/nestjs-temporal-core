# NestJS Temporal Core

A comprehensive NestJS integration framework for Temporal.io that provides enterprise-ready workflow orchestration with automatic discovery, declarative decorators, and robust monitoring capabilities.

[![npm version](https://badge.fury.io/js/nestjs-temporal-core.svg)](https://badge.fury.io/js/nestjs-temporal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Module Variants](#module-variants)
- [Configuration](#configuration)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Advanced Usage](#advanced-usage)
- [Health Monitoring](#health-monitoring)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
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

## Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/common
```

### Peer Dependencies

The package requires the following peer dependencies:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick Start

### 1. Enable Shutdown Hooks

First, enable shutdown hooks in your `main.ts` for proper Temporal resource cleanup:

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

## Configuration

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

## API Reference

### TemporalService

The main unified service providing access to all Temporal functionality:

```typescript
class TemporalService {
  /**
   * Start a workflow execution
   * @param workflowType - Name of the workflow function
   * @param args - Array of arguments to pass to the workflow
   * @param options - Workflow execution options
   */
  async startWorkflow<T>(
    workflowType: string,
    args?: unknown[],
    options?: WorkflowStartOptions
  ): Promise<WorkflowExecutionResult<T>>

  /**
   * Send a signal to a running workflow
   * @param workflowId - The workflow ID
   * @param signalName - Name of the signal
   * @param args - Arguments for the signal
   */
  async signalWorkflow(
    workflowId: string,
    signalName: string,
    args?: unknown[]
  ): Promise<WorkflowSignalResult>

  /**
   * Query a running workflow
   * @param workflowId - The workflow ID
   * @param queryName - Name of the query
   * @param args - Arguments for the query
   */
  async queryWorkflow<T>(
    workflowId: string,
    queryName: string,
    args?: unknown[]
  ): Promise<WorkflowQueryResult<T>>

  /**
   * Get a workflow handle to interact with it
   * @param workflowId - The workflow ID
   * @param runId - Optional run ID for specific execution
   */
  async getWorkflowHandle<T>(
    workflowId: string,
    runId?: string
  ): Promise<T>

  /**
   * Terminate a workflow execution
   * @param workflowId - The workflow ID
   * @param reason - Termination reason
   */
  async terminateWorkflow(
    workflowId: string,
    reason?: string
  ): Promise<WorkflowTerminationResult>

  /**
   * Cancel a workflow execution
   * @param workflowId - The workflow ID
   */
  async cancelWorkflow(
    workflowId: string
  ): Promise<WorkflowCancellationResult>

  /**
   * Get service health status
   */
  getHealth(): ServiceHealth

  /**
   * Create a schedule
   */
  async createSchedule(options: ScheduleCreateOptions): Promise<ScheduleHandle>

  /**
   * List all schedules
   */
  async listSchedules(): Promise<ScheduleListDescription[]>

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void>
}
```

### WorkflowStartOptions

Options for starting workflows:

```typescript
interface WorkflowStartOptions {
  workflowId?: string;                    // Unique workflow ID
  taskQueue?: string;                     // Task queue name
  workflowExecutionTimeout?: Duration;    // Total workflow timeout
  workflowRunTimeout?: Duration;          // Single run timeout
  workflowTaskTimeout?: Duration;         // Decision task timeout
  memo?: Record<string, unknown>;         // Workflow memo
  searchAttributes?: SearchAttributes;     // Search attributes for filtering
}
```

### Result Types

```typescript
interface WorkflowExecutionResult<T> {
  success: boolean;
  result: T;                              // Contains workflowId, runId, etc.
  executionTime: number;
  error?: Error;
}

interface WorkflowQueryResult<T> {
  success: boolean;
  result: T;
  workflowId: string;
  queryName: string;
}

interface WorkflowSignalResult {
  success: boolean;
  workflowId: string;
  signalName: string;
}
```

## Examples

## Examples

### Example 1: E-commerce Order Processing

Complete example with compensation logic:

```typescript
// order.activity.ts
@Injectable()
@Activity({ name: 'order-activities' })
export class OrderActivity {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly emailService: EmailService,
  ) {}
  
  @ActivityMethod('validatePayment')
  async validatePayment(paymentData: PaymentData): Promise<PaymentResult> {
    return await this.paymentService.validate(paymentData);
  }

  @ActivityMethod('chargePayment')
  async chargePayment(paymentData: PaymentData): Promise<{ transactionId: string }> {
    return await this.paymentService.charge(paymentData);
  }

  @ActivityMethod('refundPayment')
  async refundPayment(transactionId: string): Promise<void> {
    await this.paymentService.refund(transactionId);
  }

  @ActivityMethod('reserveInventory')
  async reserveInventory(items: OrderItem[]): Promise<{ reservationId: string }> {
    return await this.inventoryService.reserve(items);
  }

  @ActivityMethod('releaseInventory')
  async releaseInventory(reservationId: string): Promise<void> {
    await this.inventoryService.release(reservationId);
  }

  @ActivityMethod('sendConfirmationEmail')
  async sendConfirmationEmail(order: Order): Promise<void> {
    await this.emailService.sendConfirmation(order);
  }
}

// order.workflow.ts
import { proxyActivities, defineSignal, defineQuery, setHandler } from '@temporalio/workflow';
import type { OrderActivity } from './order.activity';

const {
  validatePayment,
  chargePayment,
  refundPayment,
  reserveInventory,
  releaseInventory,
  sendConfirmationEmail,
} = proxyActivities<typeof OrderActivity.prototype>({
  startToCloseTimeout: '5m',
  retry: { maximumAttempts: 3 },
});

export const cancelOrderSignal = defineSignal<[string]>('cancelOrder');
export const getOrderStatusQuery = defineQuery<OrderStatus>('getOrderStatus');

export async function processOrderWorkflow(orderData: OrderData): Promise<OrderResult> {
  let status: OrderStatus = 'pending';
  let transactionId: string | undefined;
  let reservationId: string | undefined;
  let cancelled = false;

  setHandler(cancelOrderSignal, (reason: string) => {
    cancelled = true;
  });

  setHandler(getOrderStatusQuery, () => status);

  try {
    // Step 1: Validate payment
    status = 'validating_payment';
    const paymentValid = await validatePayment(orderData.payment);
    if (!paymentValid.valid) {
      throw new Error('Invalid payment method');
    }

    // Check cancellation
    if (cancelled) {
      status = 'cancelled';
      return { orderId: orderData.orderId, status };
    }

    // Step 2: Reserve inventory
    status = 'reserving_inventory';
    const reservation = await reserveInventory(orderData.items);
    reservationId = reservation.reservationId;

    // Step 3: Charge payment
    status = 'charging_payment';
    const payment = await chargePayment(orderData.payment);
    transactionId = payment.transactionId;

    // Step 4: Send confirmation
    status = 'sending_confirmation';
    await sendConfirmationEmail({
      orderId: orderData.orderId,
      items: orderData.items,
      total: orderData.totalAmount,
    });

    status = 'completed';
    return {
      orderId: orderData.orderId,
      status,
      transactionId,
      reservationId,
    };
  } catch (error) {
    // Compensation logic
    status = 'compensating';

    if (reservationId) {
      await releaseInventory(reservationId);
    }

    if (transactionId) {
      await refundPayment(transactionId);
    }

    status = 'failed';
    throw error;
  }
}

// order.service.ts
@Injectable()
export class OrderService {
  constructor(private readonly temporal: TemporalService) {}

  async createOrder(orderData: OrderData) {
    const result = await this.temporal.startWorkflow(
      'processOrderWorkflow',
      [orderData],
      {
        workflowId: `order-${orderData.orderId}`,
        taskQueue: 'order-queue',
      }
    );

    return result.result;
  }

  async getOrderStatus(orderId: string) {
    const result = await this.temporal.queryWorkflow(
      `order-${orderId}`,
      'getOrderStatus'
    );
    
    return result.result;
  }

  async cancelOrder(orderId: string, reason: string) {
    await this.temporal.signalWorkflow(
      `order-${orderId}`,
      'cancelOrder',
      [reason]
    );
  }
}
```

### Example 2: Scheduled Reports

Creating and managing scheduled workflows:

```typescript
// report.activity.ts
@Injectable()
@Activity({ name: 'report-activities' })
export class ReportActivity {
  constructor(
    private readonly reportService: ReportService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
  ) {}
  
  @ActivityMethod('generateSalesReport')
  async generateSalesReport(period: ReportPeriod): Promise<ReportData> {
    return await this.reportService.generateSales(period);
  }

  @ActivityMethod('uploadReport')
  async uploadReport(reportData: ReportData): Promise<string> {
    return await this.storageService.upload(reportData);
  }

  @ActivityMethod('notifyStakeholders')
  async notifyStakeholders(reportUrl: string, recipients: string[]): Promise<void> {
    await this.notificationService.send(recipients, reportUrl);
  }
}

// report.workflow.ts
import { proxyActivities } from '@temporalio/workflow';
import type { ReportActivity } from './report.activity';

const { generateSalesReport, uploadReport, notifyStakeholders } = 
  proxyActivities<typeof ReportActivity.prototype>({
    startToCloseTimeout: '10m',
  });

export async function weeklyReportWorkflow(): Promise<ReportResult> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Generate report
  const reportData = await generateSalesReport({
    startDate,
    endDate,
    type: 'weekly',
  });

  // Upload to storage
  const reportUrl = await uploadReport(reportData);

  // Notify stakeholders
  await notifyStakeholders(reportUrl, ['management@company.com']);

  return {
    reportUrl,
    generatedAt: new Date(),
    period: { startDate, endDate },
  };
}

// schedule.service.ts
@Injectable()
export class ReportScheduleService {
  constructor(private readonly temporal: TemporalService) {}

  async setupWeeklyReports() {
    await this.temporal.createSchedule({
      scheduleId: 'weekly-sales-report',
      spec: {
        cronExpressions: ['0 9 * * MON'], // Every Monday at 9 AM
      },
      action: {
        type: 'startWorkflow',
        workflowType: 'weeklyReportWorkflow',
        taskQueue: 'reports-queue',
      },
      policies: {
        overlap: 'SKIP',
        catchupWindow: '1 hour',
      },
    });
  }

  async deleteSchedule(scheduleId: string) {
    await this.temporal.deleteSchedule(scheduleId);
  }

  async listAllSchedules() {
    return await this.temporal.listSchedules();
  }
}
```

## Advanced Usage

### Activity Retry Configuration

Configure custom retry policies for different activity types:

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

const emailActivities = proxyActivities<typeof EmailActivity.prototype>({
  startToCloseTimeout: '2m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '500ms',
  },
});
```

### Workflow Testing

Test workflows using Temporal's testing framework:

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { processOrderWorkflow } from './order.workflow';
import { OrderActivity } from './order.activity';

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

### Child Workflows

Organize complex workflows using child workflows:

```typescript
// parent.workflow.ts
import { startChild } from '@temporalio/workflow';

export async function parentWorkflow(orderId: string) {
  // Start child workflows
  const paymentHandle = await startChild(processPaymentWorkflow, {
    workflowId: `payment-${orderId}`,
    args: [paymentData],
  });

  const shippingHandle = await startChild(processShippingWorkflow, {
    workflowId: `shipping-${orderId}`,
    args: [shippingData],
  });

  // Wait for both to complete
  const [paymentResult, shippingResult] = await Promise.all([
    paymentHandle.result(),
    shippingHandle.result(),
  ]);

  return {
    payment: paymentResult,
    shipping: shippingResult,
  };
}
```

### Continue-As-New for Long-Running Workflows

Use continue-as-new to prevent event history from growing too large:

```typescript
import { continueAsNew } from '@temporalio/workflow';

export async function processEventStreamWorkflow(cursor: number): Promise<void> {
  const events = await fetchEvents(cursor);
  
  for (const event of events) {
    await processEvent(event);
  }

  // Continue as new after processing 1000 events
  if (events.length >= 1000) {
    await continueAsNew<typeof processEventStreamWorkflow>(cursor + events.length);
  }
}
```

### Custom Error Handling

Implement custom error types and handling:

```typescript
// activities
export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

@ActivityMethod('processData')
async processData(data: any): Promise<any> {
  try {
    return await this.externalApi.process(data);
  } catch (error) {
    if (error.code === 'RATE_LIMIT') {
      throw new RetryableError('Rate limit exceeded, will retry');
    } else if (error.code === 'INVALID_DATA') {
      throw new NonRetryableError('Invalid data format');
    }
    throw error;
  }
}

// workflow configuration
const activities = proxyActivities<typeof DataActivity.prototype>({
  startToCloseTimeout: '5m',
  retry: {
    nonRetryableErrorTypes: ['NonRetryableError'],
  },
});
```

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

  @Get('/detailed')
  async getDetailedHealth() {
    const health = this.temporal.getHealth();
    const stats = this.temporal.getStatistics();
    
    return {
      health,
      statistics: stats,
      performance: {
        workflowStartLatency: stats.averageWorkflowStartTime,
        activityExecutionCount: stats.totalActivitiesExecuted,
      },
    };
  }
}
```

### Health Check Response

```typescript
interface ServiceHealth {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  client: {
    status: 'healthy' | 'unhealthy';
    connectionStatus: 'connected' | 'disconnected';
  };
  worker: {
    status: 'healthy' | 'unhealthy';
    state: 'RUNNING' | 'STOPPED' | 'FAILED';
    activitiesCount: number;
  };
  discovery: {
    status: 'healthy' | 'unhealthy';
    activitiesDiscovered: number;
  };
  uptime: number;
  lastChecked: Date;
}
```
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Errors

**Problem:** Cannot connect to Temporal server

```
Error: Failed to connect to localhost:7233
```

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

```
Error: Activity 'myActivity' not found
```

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

```
Error: Workflow 'myWorkflow' not found
```

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

```
Error: Activity timed out after 10s
```

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

#### 5. Worker Not Starting

**Problem:** Worker fails to start or crashes

```
Error: Worker failed to start
```

**Solutions:**
```typescript
// 1. Check worker configuration
TemporalModule.register({
  worker: {
    autoStart: true, // Ensure autoStart is true
    workflowsPath: require.resolve('./workflows'),
    activityClasses: [MyActivity],
  },
})

// 2. Check logs
// Enable debug logging
TemporalModule.register({
  logLevel: 'debug',
  enableLogger: true,
})

// 3. Verify worker health
const health = temporalService.getHealth();
console.log('Worker status:', health.worker.state);

// 4. Check for port conflicts or resource issues
```

#### 6. Signal/Query Not Working

**Problem:** Signals or queries not being handled

**Solutions:**
```typescript
// 1. Define signals/queries at module level (not inside workflow)
export const mySignal = defineSignal<[string]>('mySignal');
export const myQuery = defineQuery<string>('myQuery');

// 2. Set up handlers in workflow
export async function myWorkflow() {
  let value = 'initial';
  
  setHandler(mySignal, (newValue: string) => {
    value = newValue;
  });
  
  setHandler(myQuery, () => value);
  
  // ... workflow logic
}

// 3. Use correct names when signaling/querying
await temporal.signalWorkflow(workflowId, 'mySignal', ['newValue']);
const result = await temporal.queryWorkflow(workflowId, 'myQuery');
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

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

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

**Made with ❤️ by [Simform](https://www.simform.com/)**
