# NestJS Temporal Core

Complete NestJS integration for Temporal.io with unified service architecture, comprehensive workflow management, and enterprise-ready features.

[![codecov](https://codecov.io/github/harsh-simform/nestjs-temporal-core/graph/badge.svg?token=BYSE45L6DI)](https://codecov.io/github/harsh-simform/nestjs-temporal-core)
![Statements](https://img.shields.io/badge/statements-99.91%25-brightgreen.svg?style=flat)
![Branches](https://img.shields.io/badge/branches-98.89%25-brightgreen.svg?style=flat)
![Functions](https://img.shields.io/badge/functions-98.52%25-brightgreen.svg?style=flat)
![Lines](https://img.shields.io/badge/lines-99.9%25-brightgreen.svg?style=flat)

## 🚀 Features

- **Unified TemporalModule** with sync and async configuration support
- **Comprehensive TemporalService** providing all Temporal functionality in one place
- **Workflow Management** with decorators (`@Workflow()`, `@SignalMethod()`, `@QueryMethod()`)
- **Activity Management** with decorators (`@Activity()`, `@ActivityMethod()`)
- **Advanced Worker Management** with health monitoring and lifecycle control
- **Schedule Management** with full CRUD operations and validation
- **Automatic Discovery** of workflows, activities, and scheduled methods
- **Enhanced Logging** with structured logging and different log levels
- **Health Monitoring** with comprehensive system status reporting
- **Error Handling** with detailed error messages and validation
- **Unified Service Architecture** with single entry point (`TemporalService`)
- **Service-Based Modular Design** with specialized services for each concern
- **SOLID Principles** applied throughout the codebase
- **TypeScript Best Practices** with comprehensive type safety
- **Improved Configuration Management** with flexible async options
- **Clean Service Exports** for all specialized services
- **Full TypeScript Typings** for all interfaces and configurations
- **Comprehensive JSDoc Documentation** throughout the codebase
- **Specialized Services** for client, worker, schedule, discovery, and metadata operations

## 📦 Installation

```bash
npm install nestjs-temporal-core
```

## 🔧 Quick Start

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalModule.register({
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      taskQueue: 'my-task-queue',
      worker: {
        workflowsPath: './dist/workflows',
        activityClasses: [MyActivityClass],
        autoStart: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Async Configuration

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TemporalModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TemporalModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          address: configService.get('TEMPORAL_ADDRESS'),
          namespace: configService.get('TEMPORAL_NAMESPACE'),
        },
        taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
        worker: {
          workflowsPath: configService.get('WORKFLOWS_PATH'),
          activityClasses: [], // Add your activity classes here
          autoStart: true,
        },
        enableLogger: true,
        logLevel: 'info',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Client-Only Setup (No Worker)

```typescript
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';

@Module({
  imports: [
    TemporalModule.register({
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      // Omit worker configuration for client-only setup
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### Application Bootstrap (Required for Safe Shutdown)

**Important:** To ensure safe worker shutdown and proper cleanup, you must enable shutdown hooks in your main.ts file:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable shutdown hooks for safe Temporal worker cleanup
  app.enableShutdownHooks();
  
  await app.listen(3000);
}
bootstrap();
```

Without `enableShutdownHooks()`, Temporal workers may not shut down gracefully, which can lead to:
- Incomplete workflow executions
- Resource leaks
- Connection timeouts
- Inconsistent application state

## 🎯 Decorators

### Activity Decorators

```typescript
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

@Activity({ name: 'email-activities' })
export class EmailActivities {
  @ActivityMethod('sendEmail')
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Implementation
  }

  @ActivityMethod({
    name: 'processEmail',
    timeout: '5m',
    maxRetries: 3,
  })
  async processEmail(emailData: any): Promise<void> {
    // Implementation
  }
}
```

### Workflow Decorators

```typescript
import { Workflow, SignalMethod, QueryMethod } from 'nestjs-temporal-core';

@Workflow({ name: 'order-processing' })
export class OrderWorkflow {
  @SignalMethod('addItem')
  async addItem(item: any) {
    // Handle signal
  }

  @SignalMethod('cancel-order')
  async cancelOrder() {
    // Handle cancel signal
  }

  @QueryMethod('getStatus')
  getOrderStatus(): string {
    return this.status;
  }

  @QueryMethod('get-order-details')
  getOrderDetails() {
    return this.orderDetails;
  }
}
```

### Scheduling Decorators

```typescript
import { Scheduled, Cron, Interval } from 'nestjs-temporal-core';

export class ReportController {
  @Scheduled({
    scheduleId: 'daily-report',
    cron: '0 8 * * *',
    description: 'Daily sales report'
  })
  async generateDailyReport() {
    // workflow logic
  }

  @Cron('0 0 1 * *', {
    scheduleId: 'monthly-summary',
    description: 'Monthly summary'
  })
  async generateMonthlyReport() {
    // workflow logic
  }

  @Interval('5m', {
    scheduleId: 'health-check',
    description: 'Health check every 5 minutes'
  })
  async healthCheck() {
    // workflow logic
  }
}
```

## 🔧 Usage

### Using the Temporal Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class OrderService {
  constructor(private readonly temporal: TemporalService) {}

  async processOrder(orderId: string) {
    // Start workflow
    const { workflowId, result } = await this.temporal.startWorkflow(
      'processOrder',
      [orderId],
      { taskQueue: 'orders' }
    );

    return { workflowId, result };
  }

  async getOrderStatus(workflowId: string) {
    return await this.temporal.queryWorkflow(workflowId, 'getStatus');
  }

  async cancelOrder(workflowId: string) {
    await this.temporal.signalWorkflow(workflowId, 'cancelOrder');
  }
}
```

### Schedule Management

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class ScheduleService {
  constructor(private readonly temporal: TemporalService) {}

  async triggerSchedule(scheduleId: string) {
    await this.temporal.triggerSchedule(scheduleId);
  }

  async pauseSchedule(scheduleId: string) {
    await this.temporal.pauseSchedule(scheduleId, 'Manual pause');
  }

  async resumeSchedule(scheduleId: string) {
    await this.temporal.resumeSchedule(scheduleId, 'Manual resume');
  }
}
```

### Health Monitoring

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class HealthService {
  constructor(private readonly temporal: TemporalService) {}

  async getSystemHealth() {
    return await this.temporal.getOverallHealth();
  }

  async getWorkerStatus() {
    return this.temporal.getWorkerStatus();
  }

  async getDiscoveryStats() {
    return this.temporal.getDiscoveryStats();
  }
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📚 API Reference

### TemporalModule

#### `TemporalModule.register(options)`
Register the module with synchronous configuration. Supports both client and worker functionality based on configuration.

#### `TemporalModule.registerAsync(options)`
Register the module with asynchronous configuration using factory functions, classes, or existing providers.

### TemporalService

#### Core Service Access
- `getClient()` - Get the Temporal client service for advanced operations
- `getScheduleService()` - Get the schedule service for schedule management
- `getDiscoveryService()` - Get the discovery service for introspection
- `getWorkerManager()` - Get the worker manager if available

#### Workflow Operations
- `startWorkflow<T, A>(workflowType, args, options)` - Start a workflow with type safety
- `signalWorkflow(workflowId, signalName, args?)` - Send signal to workflow with validation
- `queryWorkflow<T>(workflowId, queryName, args?)` - Query workflow state with validation
- `terminateWorkflow(workflowId, reason?)` - Terminate workflow with enhanced logging
- `cancelWorkflow(workflowId)` - Cancel workflow with enhanced logging

#### Schedule Operations
- `triggerSchedule(scheduleId)` - Trigger a managed schedule with validation
- `pauseSchedule(scheduleId, note?)` - Pause a managed schedule with validation
- `resumeSchedule(scheduleId, note?)` - Resume a managed schedule with validation
- `deleteSchedule(scheduleId, force?)` - Delete a managed schedule with confirmation
- `getScheduleIds()` - Get all managed schedule IDs
- `getScheduleInfo(scheduleId)` - Get schedule information by ID
- `hasSchedule(scheduleId)` - Check if a schedule exists

#### Worker Operations
- `hasWorker()` - Check if worker is available
- `getWorkerStatus()` - Get worker status if available
- `restartWorker()` - Restart worker if available
- `getWorkerHealth()` - Get worker health status

#### Health & Monitoring
- `getSystemStatus()` - Get comprehensive system status
- `getOverallHealth()` - Get overall system health with component breakdown
- `getDiscoveryStats()` - Get discovery statistics
- `getScheduleStats()` - Get schedule statistics

#### Utility Methods
- `getAvailableWorkflows()` - Get available workflow types
- `getWorkflowInfo(workflowName)` - Get workflow information
- `hasWorkflow(workflowName)` - Check if workflow exists

### Decorators

#### `@Activity(options?)`
Mark a class as a Temporal activity.

#### `@ActivityMethod(nameOrOptions?)`
Mark a method as a Temporal activity method.

#### `@Workflow(options?)`
Mark a class as a Temporal workflow controller.

#### `@SignalMethod(signalName?)`
Mark a method as a Temporal signal handler.

#### `@QueryMethod(queryName?)`
Mark a method as a Temporal query handler.

#### `@Scheduled(options)`
Mark a method as a scheduled workflow with cron or interval timing.

#### `@Cron(cronExpression, options)`
Shorthand decorator for cron-based scheduling.

#### `@Interval(interval, options)`
Shorthand decorator for interval-based scheduling.

## 🎛️ Specialized Services

The package exports several specialized services for advanced use cases:

### TemporalClientService
Direct access to Temporal client operations:
```typescript
import { TemporalClientService } from 'nestjs-temporal-core';

@Injectable()
export class MyService {
  constructor(private clientService: TemporalClientService) {}
  
  async advancedWorkflowOperation() {
    const client = this.clientService.getRawClient();
    // Direct Temporal client operations
  }
}
```

### TemporalWorkerManagerService
Worker lifecycle and health management:
```typescript
import { TemporalWorkerManagerService } from 'nestjs-temporal-core';

@Injectable()
export class WorkerHealthService {
  constructor(private workerManager: TemporalWorkerManagerService) {}
  
  async checkWorkerHealth() {
    const status = this.workerManager.getWorkerStatus();
    if (!status.isHealthy) {
      await this.workerManager.restartWorker();
    }
  }
}
```

### TemporalScheduleService
Advanced schedule operations:
```typescript
import { TemporalScheduleService } from 'nestjs-temporal-core';

@Injectable()
export class ScheduleManagementService {
  constructor(private scheduleService: TemporalScheduleService) {}
  
  async manageSchedules() {
    const stats = this.scheduleService.getScheduleStats();
    // Advanced schedule operations
  }
}
```

### TemporalDiscoveryService
Workflow and activity introspection:
```typescript
import { TemporalDiscoveryService } from 'nestjs-temporal-core';

@Injectable()
export class IntrospectionService {
  constructor(private discoveryService: TemporalDiscoveryService) {}
  
  getSystemInfo() {
    return {
      workflows: this.discoveryService.getWorkflowNames(),
      schedules: this.discoveryService.getScheduleIds(),
      stats: this.discoveryService.getStats(),
    };
  }
}
```

### TemporalActivityService
Activity-specific operations:
```typescript
import { TemporalActivityService } from 'nestjs-temporal-core';

@Injectable()
export class ActivityManagementService {
  constructor(private activityService: TemporalActivityService) {}
  
  getActivityInfo() {
    // Activity-specific operations
  }
}
```

### TemporalMetadataAccessor
Metadata access and validation:
```typescript
import { TemporalMetadataAccessor } from 'nestjs-temporal-core';

@Injectable()
export class MetadataService {
  constructor(private metadataAccessor: TemporalMetadataAccessor) {}
  
  getMetadata() {
    // Metadata operations
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.