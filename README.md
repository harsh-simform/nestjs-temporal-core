# NestJS Temporal Core

Complete NestJS integration for Temporal.io with unified service architecture, comprehensive workflow management, and enterprise-ready features.

[![codecov](https://codecov.io/github/harsh-simform/nestjs-temporal-core/graph/badge.svg?token=BYSE45L6DI)](https://codecov.io/github/harsh-simform/nestjs-temporal-core)
![Statements](https://img.shields.io/badge/statements-15.96%25-red.svg?style=flat)
![Branches](https://img.shields.io/badge/branches-11.58%25-red.svg?style=flat)
![Functions](https://img.shields.io/badge/functions-12.75%25-red.svg?style=flat)
![Lines](https://img.shields.io/badge/lines-15.66%25-red.svg?style=flat)

## 🚀 Features

- **Unified TemporalModule** with sync and async configuration support
- **Comprehensive TemporalService** providing all Temporal functionality in one place
- **Complete Decorator Suite** for workflows, activities, signals, and queries
- **Advanced Worker Management** with health monitoring and lifecycle control
- **Automatic Discovery** of workflows, activities, signals, and queries
- **Enhanced Health Monitoring** with comprehensive system status reporting and health endpoints
- **Service-Based Architecture** with specialized services for each concern
- **TypeScript Best Practices** with comprehensive type safety and JSDoc documentation
- **Enterprise Ready** with error handling, validation, and production monitoring

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
          activityClasses: [],
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

### Application Bootstrap (Required for Safe Shutdown)

**Important:** Enable shutdown hooks in your main.ts file for proper cleanup:

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

## 🎯 Decorators

### Activity Decorators

```typescript
import { Activity, ActivityMethod, InjectWorkflowClient } from 'nestjs-temporal-core';
import { Injectable } from '@nestjs/common';

@Activity({ name: 'email-activities' })
@Injectable()
export class EmailActivities {
  @InjectWorkflowClient()
  private workflowClient: any;

  @ActivityMethod('sendEmail')
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Send email implementation
  }

  @ActivityMethod({
    name: 'processEmail',
    timeout: '5m',
    maxRetries: 3,
  })
  async processEmail(emailData: any): Promise<void> {
    // Process email implementation
  }
}
```

### Workflow Decorators

```typescript
import { 
  Workflow, 
  WorkflowRun, 
  SignalMethod, 
  QueryMethod,
  InjectActivity,
  ChildWorkflow 
} from 'nestjs-temporal-core';

@Workflow({ name: 'order-processing', description: 'Handles order lifecycle' })
export class OrderWorkflow {
  private orderStatus = 'pending';
  private orderItems: any[] = [];

  @InjectActivity(EmailActivities, { startToCloseTimeout: '1m' })
  private emailActivities: EmailActivities;

  @ChildWorkflow(PaymentWorkflow, { taskQueue: 'payments' })
  private paymentWorkflow: PaymentWorkflow;

  @WorkflowRun()
  async execute(orderId: string): Promise<any> {
    this.orderStatus = 'processing';
    // Workflow logic here
    return { orderId, status: this.orderStatus };
  }

  @SignalMethod('addItem')
  async addItem(item: any): Promise<void> {
    this.orderItems.push(item);
  }

  @SignalMethod('cancel-order')
  async cancelOrder(): Promise<void> {
    this.orderStatus = 'cancelled';
  }

  @QueryMethod('getStatus')
  getOrderStatus(): string {
    return this.orderStatus;
  }

  @QueryMethod('get-order-details')
  getOrderDetails() {
    return { status: this.orderStatus, items: this.orderItems };
  }
}
```

### Discovery and Metadata

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalDiscoveryService } from 'nestjs-temporal-core';

@Injectable()
export class DiscoveryService {
  constructor(private discoveryService: TemporalDiscoveryService) {}

  getSystemInfo() {
    return {
      workflows: this.discoveryService.getWorkflowNames(),
      signals: this.discoveryService.getSignals(),
      queries: this.discoveryService.getQueries(),
      activities: this.discoveryService.getActivityNames(),
      stats: this.discoveryService.getStats()
    };
  }

  getWorkflowMetadata(workflowName: string) {
    return this.discoveryService.getWorkflowInfo(workflowName);
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
    // Start workflow with enhanced options
    const handle = await this.temporal.startWorkflow(
      'order-processing',
      [orderId],
      {
        taskQueue: 'orders',
        workflowId: `order-${orderId}`,
        workflowIdReusePolicy: 'ALLOW_DUPLICATE'
      }
    );

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    };
  }

  async getOrderStatus(workflowId: string) {
    return await this.temporal.queryWorkflow(workflowId, 'getStatus');
  }

  async addOrderItem(workflowId: string, item: any) {
    await this.temporal.signalWorkflow(workflowId, 'addItem', [item]);
  }

  async cancelOrder(workflowId: string) {
    await this.temporal.signalWorkflow(workflowId, 'cancel-order');
  }
}
```

### Worker Management

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class WorkerService {
  constructor(private readonly temporal: TemporalService) {}

  async manageWorker() {
    // Check if worker is available
    const hasWorker = this.temporal.hasWorker();
    
    // Get detailed worker status
    const workerStatus = this.temporal.getWorkerStatus();
    
    // Get worker health information
    const workerHealth = await this.temporal.getWorkerHealth();
    
    // Restart worker if needed
    if (!workerStatus.isHealthy) {
      await this.temporal.restartWorker();
    }
    
    return { hasWorker, workerStatus, workerHealth };
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
    // Get overall system health with component breakdown
    return await this.temporal.getOverallHealth();
  }

  async getDetailedStatus() {
    return {
      system: await this.temporal.getSystemStatus(),
      worker: this.temporal.getWorkerStatus(),
      discovery: this.temporal.getDiscoveryStats()
    };
  }

  async restartWorkerIfNeeded() {
    const workerStatus = this.temporal.getWorkerStatus();
    if (!workerStatus.isHealthy) {
      await this.temporal.restartWorker();
    }
  }
}
```

## 📚 API Reference

### TemporalModule

#### Static Methods
- **`register(options: TemporalOptions)`** - Synchronous module registration
- **`registerAsync(options: TemporalAsyncOptions)`** - Asynchronous module registration

### TemporalService (Main Service)

#### Workflow Operations
- **`startWorkflow<T>(workflowType, args, options)`** - Start workflow execution
- **`signalWorkflow(workflowId, signalName, args?)`** - Send signal to workflow
- **`queryWorkflow<T>(workflowId, queryName, args?)`** - Query workflow state  
- **`terminateWorkflow(workflowId, reason?)`** - Terminate workflow
- **`cancelWorkflow(workflowId)`** - Cancel workflow gracefully

#### Discovery Operations
- **`getAvailableWorkflows()`** - Get available workflow types
- **`getWorkflowInfo(workflowName)`** - Get workflow information
- **`hasWorkflow(workflowName)`** - Check if workflow exists

#### Health & Monitoring
- **`getSystemStatus()`** - Get comprehensive system status
- **`getOverallHealth()`** - Get overall system health
- **`getWorkerHealth()`** - Get worker health status
- **`getDiscoveryStats()`** - Get discovery statistics

#### Worker Management
- **`hasWorker()`** - Check if worker is available
- **`getWorkerStatus()`** - Get detailed worker status
- **`restartWorker()`** - Restart worker

### Specialized Services

#### TemporalClientService
Direct client operations and workflow management.

```typescript
@Injectable()
export class AdvancedWorkflowService {
  constructor(private clientService: TemporalClientService) {}

  async getWorkflowHandle(workflowId: string) {
    return this.clientService.getWorkflowHandle(workflowId);
  }

  async listWorkflows(query?: string) {
    return this.clientService.listWorkflows(query);
  }
}
```

#### TemporalWorkerService
Worker lifecycle and health management.

```typescript
@Injectable()
export class WorkerManagementService {
  constructor(private workerService: TemporalWorkerService) {}

  async checkWorkerHealth() {
    return this.workerService.healthCheck();
  }

  async getWorkerConnection() {
    return this.workerService.getConnection();
  }

  async getWorkerState() {
    return this.workerService.getState();
  }
}
```

#### TemporalDiscoveryService
Workflow and activity introspection.

```typescript
@Injectable()
export class IntrospectionService {
  constructor(private discoveryService: TemporalDiscoveryService) {}

  getSystemInfo() {
    return {
      workflows: this.discoveryService.getWorkflowNames(),
      schedules: this.discoveryService.getScheduleIds(),
      signals: this.discoveryService.getSignals(),
      queries: this.discoveryService.getQueries(),
      stats: this.discoveryService.getStats()
    };
  }
}
```

#### TemporalActivityService
Activity management and discovery.

```typescript
@Injectable()
export class ActivityManagementService {
  constructor(private activityService: TemporalActivityService) {}

  getActivityInfo() {
    return {
      activities: this.activityService.getActivityNames(),
      handlers: this.activityService.getActivityHandlers(),
      stats: this.activityService.getActivityStats()
    };
  }
}
```

### Configuration Interfaces

#### TemporalOptions
```typescript
interface TemporalOptions {
  connection: {
    address: string;
    namespace?: string;
    tls?: boolean | TlsConfig;
    apiKey?: string;
    metadata?: Record<string, string>;
  };
  taskQueue?: string;
  worker?: {
    workflowsPath?: string;
    workflowBundle?: unknown;
    activityClasses?: Array<Type<unknown>>;
    autoStart?: boolean;
    workerOptions?: WorkerCreateOptions;
  };
  isGlobal?: boolean;
  allowConnectionFailure?: boolean;
  enableLogger?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
}
```

#### ActivityOptions
```typescript
interface ActivityOptions {
  name?: string;
  timeout?: string | Duration;
  maxRetries?: number;
  retryPolicy?: {
    maximumAttempts?: number;
    initialInterval?: string | Duration;
    maximumInterval?: string | Duration;
    backoffCoefficient?: number;
  };
}
```

## 🏥 Health Monitoring

### Built-in Health Module

Import the health module for comprehensive monitoring:

```typescript
import { TemporalHealthModule } from 'nestjs-temporal-core';

@Module({
  imports: [TemporalHealthModule],
})
export class AppModule {}
```

### Available Health Endpoints

- **GET `/temporal/health`** - Overall system health
- **GET `/temporal/health/system`** - Detailed system status
- **GET `/temporal/health/client`** - Client connectivity
- **GET `/temporal/health/worker`** - Worker status
- **GET `/temporal/health/discovery`** - Discovery service status
- **GET `/temporal/health/live`** - Liveness probe (K8s compatible)
- **GET `/temporal/health/ready`** - Readiness probe (K8s compatible)
- **GET `/temporal/health/startup`** - Startup probe (K8s compatible)

### Custom Health Checks

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class CustomHealthService {
  constructor(private temporal: TemporalService) {}

  async performHealthCheck() {
    const health = await this.temporal.getOverallHealth();
    
    if (health.status === 'unhealthy') {
      // Implement alerting or remediation logic
      throw new Error('Temporal system is unhealthy');
    }
    
    return health;
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

# Run specific test suite
npm test -- --testNamePattern="TemporalService"
```

## 🔧 Advanced Configuration

### Worker Options

```typescript
TemporalModule.register({
  connection: { /* ... */ },
  worker: {
    workflowsPath: './dist/workflows',
    activityClasses: [EmailActivities, PaymentActivities],
    autoStart: true,
    workerOptions: {
      maxConcurrentActivityTaskExecutions: 100,
      maxConcurrentWorkflowTaskExecutions: 50,
      maxActivitiesPerSecond: 200,
      enableLoggingInReplay: false,
      identity: 'my-worker-identity'
    }
  }
})
```

### TLS Configuration

```typescript
TemporalModule.register({
  connection: {
    address: 'temporal.example.com:7233',
    namespace: 'production',
    tls: {
      serverName: 'temporal.example.com',
      clientCertPair: {
        crt: fs.readFileSync('client.crt'),
        key: fs.readFileSync('client.key'),
        ca: fs.readFileSync('ca.crt')
      }
    }
  }
})
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with comprehensive tests
4. Ensure all tests pass and coverage remains high
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.