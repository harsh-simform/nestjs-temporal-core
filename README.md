# NestJS Temporal Core

A comprehensive NestJS integration framework for Temporal.io that provides enterprise-ready workflow orchestration with automatic discovery, declarative decorators, and robust monitoring capabilities.

[![npm version](https://badge.fury.io/js/nestjs-temporal-core.svg)](https://badge.fury.io/js/nestjs-temporal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/harsh-simform/nestjs-temporal-core/workflows/Node.js%20CI/badge.svg)](https://github.com/harsh-simform/nestjs-temporal-core/actions)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Core Concepts](#core-concepts)
- [API Documentation](#api-documentation)
- [Examples](#examples)
- [Advanced Usage](#advanced-usage)
- [Health Monitoring](#health-monitoring)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

NestJS Temporal Core bridges the gap between NestJS's powerful dependency injection system and Temporal.io's robust workflow orchestration engine. It provides a declarative approach to building distributed, fault-tolerant applications with automatic service discovery, enterprise-grade monitoring, and seamless integration.

### Key Benefits

- **Seamless Integration**: Native NestJS decorators and dependency injection
- **Auto-Discovery**: Automatic registration of activities and workflows
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Enterprise Ready**: Built-in health checks, monitoring, and error handling
- **Zero Configuration**: Smart defaults with extensive customization options
- **Production Grade**: Connection pooling, graceful shutdown, and fault tolerance

## Features

- **Declarative Decorators**: `@Activity`, `@ActivityMethod`, `@SignalMethod`, `@QueryMethod`
- **Automatic Discovery**: Runtime discovery and registration of workflows and activities
- **Schedule Management**: Programmatic schedule creation and management
- **Health Monitoring**: Built-in health checks and status reporting
- **Connection Management**: Automatic connection pooling and lifecycle management
- **Error Handling**: Comprehensive error handling with structured logging
- **Performance Monitoring**: Built-in metrics and performance tracking
- **Graceful Shutdown**: Clean resource cleanup and connection termination

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

### 1. Application Setup

First, enable shutdown hooks in your main.ts file for proper Temporal resource cleanup:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable shutdown hooks for graceful Temporal connection cleanup
  app.enableShutdownHooks();
  
  await app.listen(3000);
}
bootstrap();
```

### 2. Module Setup

Import and configure the `TemporalModule` in your NestJS application:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalModule.register({
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      worker: {
        taskQueue: 'my-task-queue',
        activities: [], // Auto-discovered
        workflows: [], // Auto-discovered
      },
      client: {
        namespace: 'default',
      },
    }),
  ],
})
export class AppModule {}
```

### 3. Define Activities

Create activities using the `@Activity` decorator:

```typescript
// email.activity.ts
import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
@Activity({ name: 'email-activities' })
export class EmailActivity {
  
  @ActivityMethod('sendEmail')
  async sendEmail(data: EmailData): Promise<{ messageId: string }> {
    // Email sending logic
    console.log(`Sending email to ${data.to}: ${data.subject}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { messageId: `msg_${Date.now()}` };
  }

  @ActivityMethod('validateEmail')
  async validateEmail(email: string): Promise<boolean> {
    // Email validation logic
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

### 4. Define Workflows

Create workflows and register them as providers:

```typescript
// email.workflow.ts
import { Injectable } from '@nestjs/common';
import { proxyActivities } from '@temporalio/workflow';
import { EmailData } from './email.activity';

// Import activity types for workflow
const { sendEmail, validateEmail } = proxyActivities({
  taskQueue: 'my-task-queue',
  startToCloseTimeout: '1 minute',
});

@Injectable()
export class EmailWorkflow {
  async execute(data: EmailData): Promise<{ success: boolean; messageId?: string }> {
    // Validate email first
    const isValid = await validateEmail(data.to);
    
    if (!isValid) {
      throw new Error('Invalid email address');
    }

    // Send email
    const result = await sendEmail(data);
    
    return {
      success: true,
      messageId: result.messageId,
    };
  }
}
```

### 5. Use in Controllers

Inject the `TemporalService` to start workflows:

```typescript
// email.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { EmailData } from './email.activity';

@Controller('email')
export class EmailController {
  constructor(private readonly temporalService: TemporalService) {}

  @Post('send')
  async sendEmail(@Body() emailData: EmailData) {
    const workflowId = `email-${Date.now()}`;
    
    const handle = await this.temporalService.startWorkflow({
      workflowType: 'EmailWorkflow',
      workflowId,
      args: [emailData],
      taskQueue: 'my-task-queue',
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.runId,
    };
  }

  @Post('status/:workflowId')
  async getStatus(@Param('workflowId') workflowId: string) {
    const handle = this.temporalService.getWorkflowHandle(workflowId);
    const result = await handle.result();
    return result;
  }
}
```

### 6. Register Providers

Make sure to register your activities and workflows as providers:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { EmailActivity } from './email.activity';
import { EmailWorkflow } from './email.workflow';
import { EmailController } from './email.controller';

@Module({
  imports: [
    TemporalModule.register({
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      worker: {
        taskQueue: 'my-task-queue',
      },
    }),
  ],
  controllers: [EmailController],
  providers: [EmailActivity, EmailWorkflow],
})
export class AppModule {}
```

## Configuration

### Basic Configuration

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    namespace: 'default',
    tls: false,
  },
  worker: {
    taskQueue: 'default',
    maxActivitiesPerSecond: 100,
    maxConcurrentActivityExecutions: 100,
  },
  client: {
    namespace: 'default',
  },
})
```

### Async Configuration

For dynamic configuration using environment variables or external services:

```typescript
// config.service.ts
import { Injectable } from '@nestjs/common';
import { TemporalOptionsFactory, TemporalOptions } from 'nestjs-temporal-core';

@Injectable()
export class TemporalConfigService implements TemporalOptionsFactory {
  createTemporalOptions(): TemporalOptions {
    return {
      connection: {
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
        namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        tls: process.env.TEMPORAL_TLS === 'true',
      },
      worker: {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'default',
        maxActivitiesPerSecond: parseInt(process.env.MAX_ACTIVITIES_PER_SECOND) || 100,
      },
    };
  }
}

// app.module.ts
TemporalModule.registerAsync({
  useClass: TemporalConfigService,
  imports: [ConfigModule],
})
```

### TLS Configuration

For secure connections to Temporal Cloud or self-hosted with TLS:

```typescript
TemporalModule.register({
  connection: {
    address: 'your-namespace.your-account.tmprl.cloud:7233',
    namespace: 'your-namespace.your-account',
    tls: {
      clientCertPair: {
        crt: fs.readFileSync('path/to/client.crt'),
        key: fs.readFileSync('path/to/client.key'),
      },
    },
    metadata: {
      'temporal-namespace': 'your-namespace.your-account',
    },
  },
})
```

## Core Concepts

### Activities

Activities are units of work that interact with external systems. They should be idempotent and handle retries gracefully.

```typescript
@Injectable()
@Activity({ name: 'user-activities' })
export class UserActivity {
  
  @ActivityMethod('createUser')
  async createUser(userData: CreateUserData): Promise<User> {
    // Database operations, API calls, etc.
    return await this.userService.create(userData);
  }

  @ActivityMethod('sendWelcomeEmail')
  async sendWelcomeEmail(user: User): Promise<void> {
    // Email service integration
    await this.emailService.sendWelcome(user.email, user.name);
  }
}
```

### Workflows

Workflows orchestrate activities and contain the business logic. They must be deterministic.

```typescript
@Injectable()
export class UserOnboardingWorkflow {
  async execute(userData: CreateUserData): Promise<OnboardingResult> {
    // Create user account
    const user = await createUser(userData);
    
    // Send welcome email
    await sendWelcomeEmail(user);
    
    // Setup user profile
    await setupUserProfile(user.id);
    
    return {
      userId: user.id,
      status: 'completed',
      completedAt: new Date(),
    };
  }
}
```

### Signals and Queries

Handle external events and provide workflow state information:

```typescript
export class OrderWorkflow {
  private orderStatus: OrderStatus = 'pending';
  private orderItems: OrderItem[] = [];

  @SignalMethod('addItem')
  async addItem(item: OrderItem): Promise<void> {
    this.orderItems.push(item);
  }

  @SignalMethod('cancelOrder')
  async cancelOrder(): Promise<void> {
    this.orderStatus = 'cancelled';
  }

  @QueryMethod('getOrderStatus')
  getOrderStatus(): OrderStatus {
    return this.orderStatus;
  }

  @QueryMethod('getOrderItems')
  getOrderItems(): OrderItem[] {
    return this.orderItems;
  }

  async execute(orderId: string): Promise<OrderResult> {
    // Workflow implementation
    // Use signals to handle external events
    // Use queries to expose workflow state
  }
}
```

## API Documentation

### TemporalService

The main service providing unified access to all Temporal functionality:

```typescript
class TemporalService {
  // Start a workflow
  async startWorkflow(options: WorkflowStartOptions): Promise<WorkflowHandle>;
  
  // Get workflow handle
  getWorkflowHandle(workflowId: string): WorkflowHandle;
  
  // Send signal to workflow
  async signalWorkflow(workflowId: string, signalName: string, args?: any[]): Promise<void>;
  
  // Query workflow
  async queryWorkflow(workflowId: string, queryName: string, args?: any[]): Promise<any>;
  
  // Get service health
  getHealth(): ServiceHealth;
  
  // Create schedule
  async createSchedule(options: ScheduleCreateOptions): Promise<ScheduleHandle>;
}
```

### TemporalClientService

Dedicated client operations:

```typescript
class TemporalClientService {
  // Execute workflow and wait for result
  async executeWorkflow(options: WorkflowStartOptions): Promise<any>;
  
  // Start workflow without waiting
  async startWorkflow(options: WorkflowStartOptions): Promise<WorkflowHandle>;
  
  // List workflows
  async listWorkflows(query?: string): Promise<WorkflowExecution[]>;
  
  // Terminate workflow
  async terminateWorkflow(workflowId: string, reason?: string): Promise<void>;
  
  // Cancel workflow
  async cancelWorkflow(workflowId: string): Promise<void>;
}
```

### TemporalScheduleService

Schedule management operations:

```typescript
class TemporalScheduleService {
  // Create schedule
  async createSchedule(options: ScheduleCreateOptions): Promise<ScheduleHandle>;
  
  // List schedules
  async listSchedules(): Promise<ScheduleListDescription[]>;
  
  // Delete schedule
  async deleteSchedule(scheduleId: string): Promise<void>;
  
  // Pause schedule
  async pauseSchedule(scheduleId: string, note?: string): Promise<void>;
  
  // Unpause schedule
  async unpauseSchedule(scheduleId: string, note?: string): Promise<void>;
}
```

## Examples

### Example 1: E-commerce Order Processing

Complete example of an e-commerce order processing workflow:

```typescript
// order.activity.ts
@Injectable()
@Activity({ name: 'order-activities' })
export class OrderActivity {
  
  @ActivityMethod('validatePayment')
  async validatePayment(paymentData: PaymentData): Promise<PaymentResult> {
    // Payment validation logic
    return await this.paymentService.validate(paymentData);
  }

  @ActivityMethod('reserveInventory')
  async reserveInventory(items: OrderItem[]): Promise<ReservationResult> {
    // Inventory reservation logic
    return await this.inventoryService.reserve(items);
  }

  @ActivityMethod('sendConfirmationEmail')
  async sendConfirmationEmail(order: Order): Promise<void> {
    // Email sending logic
    await this.emailService.sendConfirmation(order);
  }
}

// order.workflow.ts
@Injectable()
export class OrderWorkflow {
  private orderStatus: OrderStatus = 'pending';
  private reservationId?: string;

  @SignalMethod('cancelOrder')
  async cancelOrder(): Promise<void> {
    this.orderStatus = 'cancelled';
  }

  @QueryMethod('getOrderStatus')
  getOrderStatus(): OrderStatus {
    return this.orderStatus;
  }

  async execute(orderData: OrderData): Promise<OrderResult> {
    try {
      // Step 1: Validate payment
      const paymentResult = await validatePayment(orderData.payment);
      if (!paymentResult.valid) {
        throw new Error('Payment validation failed');
      }

      // Step 2: Reserve inventory
      const reservation = await reserveInventory(orderData.items);
      this.reservationId = reservation.id;

      // Step 3: Process order
      this.orderStatus = 'processing';

      // Step 4: Send confirmation
      await sendConfirmationEmail({
        orderId: orderData.orderId,
        items: orderData.items,
        total: orderData.total,
      });

      this.orderStatus = 'completed';

      return {
        orderId: orderData.orderId,
        status: this.orderStatus,
        reservationId: this.reservationId,
      };
    } catch (error) {
      this.orderStatus = 'failed';
      throw error;
    }
  }
}
```

### Example 2: Scheduled Reports

Creating and managing scheduled reports:

```typescript
// report.activity.ts
@Injectable()
@Activity({ name: 'report-activities' })
export class ReportActivity {
  
  @ActivityMethod('generateSalesReport')
  async generateSalesReport(period: ReportPeriod): Promise<ReportData> {
    // Generate sales report
    return await this.reportService.generateSales(period);
  }

  @ActivityMethod('uploadToS3')
  async uploadToS3(reportData: ReportData): Promise<string> {
    // Upload to S3
    return await this.s3Service.upload(reportData);
  }

  @ActivityMethod('notifyStakeholders')
  async notifyStakeholders(reportUrl: string): Promise<void> {
    // Send notifications
    await this.notificationService.sendReport(reportUrl);
  }
}

// report.workflow.ts
@Injectable()
export class WeeklyReportWorkflow {
  async execute(): Promise<ReportResult> {
    const period = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    // Generate report
    const reportData = await generateSalesReport(period);

    // Upload to storage
    const reportUrl = await uploadToS3(reportData);

    // Notify stakeholders
    await notifyStakeholders(reportUrl);

    return {
      reportUrl,
      generatedAt: new Date(),
      period,
    };
  }
}

// schedule creation
@Injectable()
export class ReportScheduleService {
  constructor(private readonly temporalService: TemporalService) {}

  async setupWeeklyReports(): Promise<void> {
    await this.temporalService.createSchedule({
      scheduleId: 'weekly-sales-report',
      spec: {
        cronExpressions: ['0 9 * * MON'], // Every Monday at 9 AM
        timeZone: 'UTC',
      },
      action: {
        type: 'startWorkflow',
        workflowType: 'WeeklyReportWorkflow',
        taskQueue: 'reports-queue',
      },
      policies: {
        overlap: 'SKIP',
        catchupWindow: '1h',
      },
    });
  }
}
```

## Advanced Usage

### Custom Error Handling

Implement custom error handling for activities and workflows:

```typescript
@Injectable()
@Activity({ name: 'custom-error-activity' })
export class CustomErrorActivity {
  
  @ActivityMethod('processWithRetry')
  async processWithRetry(data: any): Promise<any> {
    try {
      return await this.externalService.process(data);
    } catch (error) {
      // Custom error handling
      if (error instanceof TemporaryError) {
        // Let Temporal retry
        throw error;
      } else if (error instanceof PermanentError) {
        // Don't retry, fail immediately
        throw new ApplicationFailure(error.message, 'PermanentError');
      }
      // Unknown error, let Temporal handle it
      throw error;
    }
  }
}
```

### Workflow Testing

Test workflows using Temporal's testing framework:

```typescript
// order.workflow.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { OrderWorkflow } from './order.workflow';

describe('OrderWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should process order successfully', async () => {
    const worker = await testEnv.createWorker({
      workflows: [OrderWorkflow],
      activities: {
        validatePayment: async () => ({ valid: true }),
        reserveInventory: async () => ({ id: 'reservation-123' }),
        sendConfirmationEmail: async () => {},
      },
    });

    const result = await worker.runUntil(
      testEnv.client.workflow.execute(OrderWorkflow, {
        workflowId: 'test-order',
        taskQueue: 'test-queue',
        args: [{
          orderId: 'order-123',
          payment: { method: 'card', amount: 100 },
          items: [{ id: 'item-1', quantity: 1 }],
        }],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.orderId).toBe('order-123');
  });
});
```

## Health Monitoring

The package includes comprehensive health monitoring capabilities:

### Health Check Endpoint

```typescript
// app.module.ts
import { TemporalHealthModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalModule.register(/* config */),
    TemporalHealthModule, // Adds /health/temporal endpoint
  ],
})
export class AppModule {}
```

### Custom Health Checks

```typescript
@Injectable()
export class CustomHealthService {
  constructor(private readonly temporalService: TemporalService) {}

  @Get('/health/custom')
  async getCustomHealth() {
    const health = this.temporalService.getHealth();
    
    return {
      status: health.status,
      timestamp: new Date(),
      services: {
        client: health.client,
        worker: health.worker,
        discovery: health.discovery,
      },
      metrics: {
        activeWorkflows: await this.getActiveWorkflowCount(),
        queuedActivities: await this.getQueuedActivityCount(),
      },
    };
  }
}
```

## Performance Considerations

### Connection Pooling

The package automatically manages connections, but you can configure pooling:

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    maxConnections: 10,
    connectionTimeout: 30000,
  },
  worker: {
    maxConcurrentActivityExecutions: 100,
    maxActivitiesPerSecond: 1000,
  },
})
```

### Activity Optimization

Optimize activities for better performance:

```typescript
@Injectable()
@Activity({ 
  name: 'optimized-activities',
  maxConcurrentExecutions: 50,
  taskTimeout: '5m',
})
export class OptimizedActivity {
  
  @ActivityMethod('batchProcess')
  async batchProcess(items: Item[]): Promise<ProcessResult[]> {
    // Process items in batches for better performance
    const batchSize = 10;
    const results: ProcessResult[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.processItem(item))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}
```

## Troubleshooting

### Common Issues

#### Connection Problems
```typescript
// Check connection status
const health = temporalService.getHealth();
console.log('Connection status:', health.client.status);

// Enable debug logging
TemporalModule.register({
  logging: {
    level: 'debug',
    enableRequestLogging: true,
  },
})
```

#### Activity Registration Issues
```typescript
// Verify activity discovery
const discoveryStats = temporalService.getDiscoveryStats();
console.log('Discovered activities:', discoveryStats.activities);

// Manual activity registration if auto-discovery fails
TemporalModule.register({
  worker: {
    activities: [EmailActivity, OrderActivity], // Explicit registration
  },
})
```

#### Workflow Timeout Issues
```typescript
// Configure appropriate timeouts
await temporalService.startWorkflow({
  workflowType: 'LongRunningWorkflow',
  workflowId: 'long-workflow-1',
  workflowExecutionTimeout: '1h',
  workflowRunTimeout: '30m',
  workflowTaskTimeout: '10s',
});
```

### Debug Mode

Enable debug mode for detailed logging:

```typescript
TemporalModule.register({
  debug: true,
  logging: {
    level: 'debug',
    enableRequestLogging: true,
    enableResponseLogging: true,
  },
})
```

## Requirements

- Node.js >= 16.0.0
- NestJS >= 9.0.0
- Temporal Server >= 1.12.0

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/harsh-simform/nestjs-temporal-core.git

# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Generate documentation
npm run docs:generate
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/harsh-simform/nestjs-temporal-core/issues)
- Documentation: [Full API Documentation](https://harsh-simform.github.io/nestjs-temporal-core/)
- Examples: [Additional examples and tutorials](https://github.com/harsh-simform/nestjs-temporal-core/tree/main/examples)

## Changelog

See [Releases](https://github.com/harsh-simform/nestjs-temporal-core/releases) for a detailed changelog.
