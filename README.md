# NestJS Temporal Core

A simplified NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless worker and client support for building reliable distributed applications.

## Overview

NestJS Temporal Core makes it easy to integrate Temporal.io with your NestJS applications. Temporal is a durable execution system for reliable microservices and workflow orchestration.

## Features

- 🚀 **Easy NestJS Integration** - Simple module registration with unified configuration
- 🔄 **Complete Lifecycle Management** - Automatic worker initialization and graceful shutdown
- 🎯 **Declarative Decorators** - Type-safe `@Activity()`, `@ActivityMethod()`, `@Workflow()`, and more
- 🔌 **Connection Management** - Simplified connection handling with TLS support
- 🔒 **Type Safety** - Clean, strongly typed interfaces for all Temporal concepts
- 📡 **Client Utilities** - Methods for starting, signaling, and querying workflows
- 📊 **Worker Management** - Simple worker lifecycle control and monitoring
- 📅 **Scheduling** - Support for cron and interval-based workflow scheduling

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

### 2. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { EmailActivities } from './activities/email.activities';

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
                activityClasses: [EmailActivities],
                autoStart: true,
            },
            isGlobal: true,
        }),
    ],
})
export class AppModule {}
```

### 3. Define Activities

```typescript
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

@Activity()
export class EmailActivities {
    @ActivityMethod()
    async sendWelcomeEmail(to: string): Promise<boolean> {
        // Implementation
        console.log(`Sending welcome email to ${to}`);
        return true;
    }

    @ActivityMethod('sendPromoEmail')
    async sendPromotion(to: string, promoCode: string): Promise<boolean> {
        // Implementation
        console.log(`Sending promo ${promoCode} to ${to}`);
        return true;
    }
}
```

### 4. Define Workflows

Create a workflow file in your workflows directory:

```typescript
// workflows/email-workflow.ts
import { proxyActivities } from '@temporalio/workflow';

// Activities interface
interface EmailActivities {
    sendWelcomeEmail(to: string): Promise<boolean>;
    sendPromoEmail(to: string, promoCode: string): Promise<boolean>;
}

const activities = proxyActivities<EmailActivities>({
    startToCloseTimeout: '30s',
});

export async function sendWelcomeWorkflow(email: string): Promise<boolean> {
    return await activities.sendWelcomeEmail(email);
}

export async function sendPromoWorkflow(email: string, promoCode: string): Promise<boolean> {
    return await activities.sendPromoEmail(email, promoCode);
}
```

### 5. Use the Temporal Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class EmailService {
    constructor(private readonly temporalService: TemporalService) {}

    async sendWelcomeEmail(email: string): Promise<string> {
        // Use the simplified API to start a workflow
        const { workflowId } = await this.temporalService.startWorkflow(
            'sendWelcomeWorkflow',
            [email],
            'my-task-queue',
            {
                workflowId: `welcome-${email}-${Date.now()}`,
            },
        );

        return workflowId;
    }

    async sendPromoEmail(email: string, promoCode: string): Promise<string> {
        // Use the client service directly for more options
        const { workflowId } = await this.temporalService
            .getClient()
            .startWorkflow('sendPromoWorkflow', [email, promoCode], {
                taskQueue: 'my-task-queue',
                workflowId: `promo-${email}-${Date.now()}`,
                retry: {
                    maximumAttempts: 3,
                },
            });

        return workflowId;
    }
}
```

## Advanced Features

### Using Signals and Queries

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class OrderService {
    constructor(private readonly temporalService: TemporalService) {}

    async addItemToOrder(orderId: string, item: string): Promise<void> {
        // Signal a running workflow
        await this.temporalService.getClient().signalWorkflow(orderId, 'addItem', [item]);
    }

    async getOrderStatus(orderId: string): Promise<string> {
        // Query a running workflow
        return await this.temporalService.getClient().queryWorkflow(orderId, 'getStatus');
    }
}
```

### Schedule Management

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class ReportingService {
    constructor(private readonly temporalService: TemporalService) {}

    async scheduleDailyReport(): Promise<string> {
        const handle = await this.temporalService.getScheduleService().createCronWorkflow(
            'daily-report',
            'generateReportWorkflow',
            '0 0 * * *', // Daily at midnight
            'reports-queue',
            ['daily-summary'],
        );

        return handle.scheduleId;
    }

    async pauseReporting(): Promise<void> {
        await this.temporalService
            .getScheduleService()
            .pauseSchedule('daily-report', 'Paused for maintenance');
    }

    async resumeReporting(): Promise<void> {
        await this.temporalService.getScheduleService().resumeSchedule('daily-report');
    }
}
```

## Configuration Options

### Async Configuration

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TemporalModule } from 'nestjs-temporal-core';
import { EmailActivities } from './activities/email.activities';

@Module({
    imports: [
        ConfigModule.forRoot(),
        TemporalModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    address: configService.get('TEMPORAL_ADDRESS'),
                    namespace: configService.get('TEMPORAL_NAMESPACE'),
                    apiKey: configService.get('TEMPORAL_API_KEY'),
                },
                taskQueue: configService.get('TEMPORAL_TASK_QUEUE'),
                worker: {
                    workflowsPath: './dist/workflows',
                    activityClasses: [EmailActivities],
                },

                isGlobal: true,
            }),
        }),
    ],
})
export class AppModule {}
```

### Secure Connection with TLS

```typescript
TemporalModule.register({
    connection: {
        address: 'temporal.example.com:7233',
        namespace: 'production',
        tls: {
            // Simple boolean for default TLS
            // tls: true,

            // Or detailed configuration
            serverName: 'temporal.example.com',
            clientCertPair: {
                crt: fs.readFileSync('./certs/client.crt'),
                key: fs.readFileSync('./certs/client.key'),
                ca: fs.readFileSync('./certs/ca.crt'),
            },
        },
        // For Temporal Cloud
        apiKey: process.env.TEMPORAL_API_KEY,
    },
    // ...other options
});
```

```

## API Reference

### Core Modules

- `TemporalModule` - Unified module for both client and worker functionality
- `TemporalClientModule` - Client-only module for workflow operations
- `TemporalWorkerModule` - Worker-only module for running activities

### Decorators

- `@Activity(options?)` - Marks a class as a Temporal activity
- `@ActivityMethod(options?)` - Marks a method as an activity implementation
- `@Workflow(options)` - Marks a class as a Temporal workflow
- `@WorkflowMethod(options?)` - Marks the primary workflow execution method
- `@SignalMethod(name?)` - Marks a method as a signal handler
- `@QueryMethod(name?)` - Marks a method as a query handler

### Services

#### TemporalService

- `getClient()` - Get the client service
- `getScheduleService()` - Get the schedule service
- `getWorkerManager()` - Get the worker manager (if available)
- `startWorkflow()` - Simplified method to start a workflow
- `hasWorker()` - Check if worker functionality is available


#### TemporalClientService

- `startWorkflow()` - Start a new workflow execution
- `signalWorkflow()` - Send a signal to a running workflow
- `queryWorkflow()` - Query a running workflow
- `terminateWorkflow()` - Terminate a running workflow
- `cancelWorkflow()` - Request cancellation of a workflow
- `getWorkflowHandle()` - Get a handle to manage a workflow
- `describeWorkflow()` - Get workflow execution details
- `listWorkflows()` - List workflows matching a query

#### TemporalScheduleService

- `createCronWorkflow()` - Create a workflow scheduled by cron expression
- `createIntervalWorkflow()` - Create a workflow scheduled by time interval
- `pauseSchedule()` - Pause a schedule
- `resumeSchedule()` - Resume a paused schedule
- `deleteSchedule()` - Delete a schedule
- `triggerNow()` - Trigger an immediate execution
- `listSchedules()` - List all schedules

#### WorkerManager

- `startWorker()` - Manually start the worker
- `shutdown()` - Gracefully shutdown the worker
- `getWorker()` - Get the underlying worker instance

## Project Structure

When integrating Temporal with your NestJS application, organizing your code properly helps maintain separation of concerns and follows NestJS conventions. Here's a recommended project structure:

```

src/
├── temporal/
│ ├── activities/
│ │ ├── email.activities.ts
│ │ ├── payment.activities.ts
│ │ └── index.ts
│ ├── workflows/
│ │ ├── email-workflows.ts
│ │ ├── payment-workflows.ts
│ │ └── index.ts
│ ├── interfaces/
│ │ ├── email.interfaces.ts
│ │ └── payment.interfaces.ts
│ └── temporal.module.ts
├── modules/
│ ├── email/
│ │ ├── email.service.ts
│ │ ├── email.controller.ts
│ │ └── email.module.ts
│ └── payment/
│ ├── payment.service.ts
│ ├── payment.controller.ts
│ └── payment.module.ts
└── app.module.ts

````

### Key Files and Their Purpose

1. **Activities (src/temporal/activities/)**:
   - Contains activity classes decorated with `@Activity()`
   - Each activity class should group related functionality

2. **Workflows (src/temporal/workflows/)**:
   - Contains workflow definitions that orchestrate activities
   - Workflows should be in separate files based on domain

3. **Interfaces (src/temporal/interfaces/)**:
   - TypeScript interfaces that define activity and workflow parameters/returns
   - Helps maintain type safety between activities and workflows

4. **Temporal Module (src/temporal/temporal.module.ts)**:
   - Centralizes Temporal configuration
   - Imports and registers all activities

5. **Business Services (src/modules/*/)**:
   - Inject the TemporalService
   - Use it to start workflows and interact with Temporal

## Integration Examples

### Activity Definition

```typescript
// src/temporal/activities/email.activities.ts
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { Injectable } from '@nestjs/common';
import { EmailService } from '../../modules/email/email.service';

@Injectable()
@Activity()
export class EmailActivities {
  constructor(private readonly emailService: EmailService) {}

  @ActivityMethod()
  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    await this.emailService.sendEmail({
      to,
      subject: 'Welcome!',
      body: `Hello ${name}, welcome to our platform!`,
    });
    return true;
  }

  @ActivityMethod()
  async sendPasswordReset(to: string, resetToken: string): Promise<boolean> {
    await this.emailService.sendEmail({
      to,
      subject: 'Password Reset',
      body: `Please use this token to reset your password: ${resetToken}`,
    });
    return true;
  }
}
````

```typescript
// src/temporal/activities/index.ts
export * from './email.activities';
export * from './payment.activities';
// Export all other activity classes
```

### Workflow Definition

```typescript
// src/temporal/workflows/email-workflows.ts
import { proxyActivities } from '@temporalio/workflow';

// Define the interface of activities this workflow will use
export interface EmailActivities {
    sendWelcomeEmail(to: string, name: string): Promise<boolean>;
    sendPasswordReset(to: string, resetToken: string): Promise<boolean>;
}

// Create a proxy to the activities
const activities = proxyActivities<EmailActivities>({
    startToCloseTimeout: '30 seconds',
});

// Welcome workflow with retry logic
export async function welcomeUserWorkflow(email: string, name: string): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            return await activities.sendWelcomeEmail(email, name);
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                throw error;
            }
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    return false;
}

// Password reset workflow
export async function passwordResetWorkflow(email: string, resetToken: string): Promise<boolean> {
    return await activities.sendPasswordReset(email, resetToken);
}
```

### Scheduled Workflow Example

```typescript
// src/temporal/workflows/scheduled-workflows.ts
import { proxyActivities } from '@temporalio/workflow';

interface ReportActivities {
    generateDailyReport(): Promise<string>;
    emailReportToAdmins(reportUrl: string): Promise<boolean>;
}

const activities = proxyActivities<ReportActivities>({
    startToCloseTimeout: '10 minutes',
});

// This workflow will be scheduled to run daily
export async function dailyReportWorkflow(): Promise<void> {
    const reportUrl = await activities.generateDailyReport();
    await activities.emailReportToAdmins(reportUrl);
}
```

### Setting Up the Temporal Module

```typescript
// src/temporal/temporal.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { EmailActivities, PaymentActivities } from './activities';
import { EmailModule } from '../modules/email/email.module';
import { PaymentModule } from '../modules/payment/payment.module';

@Module({
    imports: [
        EmailModule,
        PaymentModule,
        TemporalModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    address: configService.get('TEMPORAL_ADDRESS', 'localhost:7233'),
                    namespace: configService.get('TEMPORAL_NAMESPACE', 'default'),
                },
                taskQueue: configService.get('TEMPORAL_TASK_QUEUE', 'my-app-queue'),
                worker: {
                    workflowsPath: path.resolve(__dirname, 'workflows'),
                    activityClasses: [EmailActivities, PaymentActivities],
                    autoStart: true,
                },
                isGlobal: true,
            }),
        }),
    ],
    providers: [EmailActivities, PaymentActivities],
    exports: [TemporalModule],
})
export class TemporalAppModule {}
```

### Using Temporal in Business Services

```typescript
// src/modules/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class EmailService {
    constructor(private readonly temporalService: TemporalService) {}

    // Your actual email sending functionality
    async sendEmail(options: { to: string; subject: string; body: string }): Promise<void> {
        // Implementation...
    }

    // Triggering a Temporal workflow
    async sendWelcomeEmail(email: string, name: string): Promise<string> {
        const { workflowId } = await this.temporalService.startWorkflow(
            'welcomeUserWorkflow',
            [email, name],
            'my-app-queue',
            { workflowId: `welcome-${email}-${Date.now()}` },
        );

        return workflowId;
    }
}
```

### Setting Up Scheduled Workflows

```typescript
// src/modules/reports/report.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class ReportService implements OnModuleInit {
    constructor(private readonly temporalService: TemporalService) {}

    async onModuleInit() {
        // Set up scheduled workflows when the module initializes
        await this.setupDailyReport();
    }

    private async setupDailyReport() {
        try {
            // Check if the schedule already exists
            const schedules = await this.temporalService.getScheduleService().listSchedules();

            if (!schedules.some((s) => s.scheduleId === 'daily-report')) {
                // Create a new schedule
                await this.temporalService.getScheduleService().createCronWorkflow(
                    'daily-report',
                    'dailyReportWorkflow',
                    '0 8 * * *', // Run every day at 8 AM
                    'my-app-queue',
                    [], // No arguments needed for this workflow
                    'Daily business report generation',
                );

                console.log('Daily report schedule created');
            }
        } catch (error) {
            console.error('Failed to set up daily report schedule:', error);
        }
    }
}
```

## Best Practices

1. **Activity Design**

    - Keep activities focused on single responsibilities
    - Set appropriate timeouts for expected durations
    - Use dependency injection within activity classes

2. **Workflow Design**

    - Make workflows deterministic
    - Use signals for external events
    - Use queries for retrieving workflow state
    - Separate workflows by domain/function

3. **Configuration**

    - Use meaningful workflow IDs for tracking
    - Configure appropriate timeouts for activities and workflows
    - Implement proper error handling

4. **Lifecycle Management**

    - Enable NestJS shutdown hooks
    - Configure proper worker shutdown grace periods
    - Consider using OnModuleInit to set up schedules

5. **Security**
    - Implement proper TLS security for production environments
    - Use namespaces to isolate different environments
    - Use API keys for Temporal Cloud authentication

## License

MIT

## Author

Harsh M
