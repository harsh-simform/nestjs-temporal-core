# NestJS Temporal Core

A comprehensive NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless workflow orchestration with auto-discovery, declarative scheduling, and production-ready features.

[![npm version](https://badge.fury.io/js/nestjs-temporal-core.svg)](https://badge.fury.io/js/nestjs-temporal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Overview

NestJS Temporal Core brings Temporal's durable execution to NestJS with familiar decorator patterns and automatic discovery. Build reliable distributed systems with workflows, activities, and scheduled tasks using native NestJS conventions.

## 🚀 Key Features

- **🎯 NestJS-Native** - Familiar patterns: `@WorkflowController`, `@Activity`, `@Cron`, `@Interval`
- **🔍 Auto-Discovery** - Automatically finds and registers workflows, activities, and schedules
- **📅 Declarative Scheduling** - Built-in cron and interval scheduling that just works
- **🔄 Unified Service** - Single `TemporalService` for all operations
- **⚙️ Flexible Setup** - Client-only, worker-only, or unified deployments
- **🏥 Health Monitoring** - Comprehensive status monitoring and health checks
- **🔧 Production Ready** - TLS, connection management, graceful shutdowns
- **📊 Complete Integration** - Full-featured module architecture

## 📦 Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow
```

## 🚀 Quick Start

### 1. Module Setup

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TemporalModule } from 'nestjs-temporal-core';
import { EmailActivities } from './activities/email.activities';
import { UserWorkflowController } from './workflows/user.controller';

@Module({
  imports: [
    TemporalModule.register({
      connection: {
        address: 'localhost:7233',
        namespace: 'default',
      },
      taskQueue: 'my-app',
      worker: {
        workflowsPath: './dist/workflows',
        activityClasses: [EmailActivities], // Auto-discovered
      },
    }),
  ],
  controllers: [UserWorkflowController], // Auto-discovered
  providers: [EmailActivities],
})
export class AppModule {}
```

### 2. Create Activities

```typescript
// activities/email.activities.ts
import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';

@Injectable()
@Activity()
export class EmailActivities {
  @ActivityMethod()
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    console.log(`Sending welcome email to ${email}`);
    // Your email logic here
    return true;
  }

  @ActivityMethod()
  async sendNotification(email: string, message: string): Promise<void> {
    console.log(`Notification to ${email}: ${message}`);
    // Your notification logic here
  }
}
```

### 3. Create Workflow Controller

```typescript
// workflows/user.controller.ts
import { WorkflowController, WorkflowMethod, Signal, Query, Cron } from 'nestjs-temporal-core';
import { proxyActivities } from '@temporalio/workflow';

// Proxy activities for use in workflows
const activities = proxyActivities<EmailActivities>({
  startToCloseTimeout: '1m',
});

@WorkflowController({ taskQueue: 'user-workflows' })
export class UserWorkflowController {
  private status = 'pending';

  @WorkflowMethod()
  async onboardUser(email: string, name: string): Promise<string> {
    this.status = 'processing';

    // Send welcome email
    await activities.sendWelcomeEmail(email, name);
    
    // Send follow-up notification  
    await activities.sendNotification(email, 'Welcome to our platform!');

    this.status = 'completed';
    return this.status;
  }

  // Automatic scheduling - runs at 9 AM daily
  @Cron('0 9 * * *', { 
    scheduleId: 'daily-user-report',
    description: 'Generate daily user report'
  })
  @WorkflowMethod()
  async generateDailyReport(): Promise<void> {
    console.log('Generating daily user report...');
    // Report generation logic
  }

  @Signal('updateStatus')
  async updateUserStatus(newStatus: string): Promise<void> {
    this.status = newStatus;
  }

  @Query('getStatus')
  getUserStatus(): string {
    return this.status;
  }
}
```

### 4. Use in Services

```typescript
// services/user.service.ts
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class UserService {
  constructor(private readonly temporal: TemporalService) {}

  async onboardNewUser(email: string, name: string): Promise<string> {
    // Start workflow - task queue auto-resolved from @WorkflowController
    const { workflowId } = await this.temporal.startWorkflow(
      'onboardUser', 
      [email, name],
      { workflowId: `onboard-${email}-${Date.now()}` }
    );

    return workflowId;
  }

  async getUserStatus(workflowId: string): Promise<string> {
    return await this.temporal.queryWorkflow(workflowId, 'getStatus');
  }

  async updateUserStatus(workflowId: string, status: string): Promise<void> {
    await this.temporal.signalWorkflow(workflowId, 'updateStatus', [status]);
  }

  // Schedule management
  async pauseDailyReport(): Promise<void> {
    await this.temporal.pauseSchedule('daily-user-report', 'Maintenance mode');
  }

  async resumeDailyReport(): Promise<void> {
    await this.temporal.resumeSchedule('daily-user-report');
  }
}
```

## ⚙️ Configuration Options

### Basic Configuration

```typescript
TemporalModule.register({
  connection: {
    address: 'localhost:7233',
    namespace: 'default',
  },
  taskQueue: 'my-app',
  worker: {
    workflowsPath: './dist/workflows',
    activityClasses: [EmailActivities, PaymentActivities],
  },
});
```

### Client-Only Mode

```typescript
TemporalModule.forClient({
  connection: {
    address: 'temporal.company.com:7233',
    namespace: 'production',
    tls: true,
  },
});
```

### Worker-Only Mode

```typescript
TemporalModule.forWorker({
  connection: {
    address: 'localhost:7233',
    namespace: 'development',
  },
  taskQueue: 'worker-queue',
  workflowsPath: './dist/workflows',
  activityClasses: [ProcessingActivities],
});
```

### Async Configuration

```typescript
TemporalModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    connection: {
      address: config.get('TEMPORAL_ADDRESS'),
      namespace: config.get('TEMPORAL_NAMESPACE'),
    },
    taskQueue: config.get('TEMPORAL_TASK_QUEUE'),
    worker: {
      workflowsPath: './dist/workflows',
      activityClasses: [EmailActivities],
    },
  }),
  inject: [ConfigService],
});
```

## 📋 Core Concepts

### Auto-Discovery
The module automatically discovers and registers:
- **Workflow Controllers** marked with `@WorkflowController`
- **Activity Classes** marked with `@Activity` 
- **Scheduled Workflows** marked with `@Cron` or `@Interval`
- **Signals and Queries** within workflow controllers

### Scheduling Made Simple
```typescript
// Just add the decorator - schedule is created automatically!
@Cron('0 8 * * *', { scheduleId: 'daily-report' })
@WorkflowMethod()
async generateReport(): Promise<void> {
  // This will run every day at 8 AM
}
```

### Enhanced Workflow Starting
```typescript
// Task queue automatically resolved from @WorkflowController
await temporal.startWorkflow('processOrder', [orderId]);

// Or override if needed
await temporal.startWorkflow('processOrder', [orderId], { taskQueue: 'special-queue' });
```

## 🔧 Common Use Cases

### Order Processing
```typescript
@WorkflowController({ taskQueue: 'orders' })
export class OrderWorkflowController {
  @WorkflowMethod()
  async processOrder(orderId: string): Promise<string> {
    // Payment, inventory, shipping - all durable
    await activities.processPayment(orderId);
    await activities.updateInventory(orderId);
    await activities.scheduleShipping(orderId);
    return 'completed';
  }
}
```

### Scheduled Reports
```typescript
@WorkflowController({ taskQueue: 'reports' })
export class ReportWorkflowController {
  @Cron('0 0 * * 0', { scheduleId: 'weekly-sales-report' })
  @WorkflowMethod()
  async generateWeeklySalesReport(): Promise<void> {
    // Automatically runs every Sunday at midnight
    await activities.generateReport('sales');
    await activities.emailReport('sales-team@company.com');
  }
}
```

### User Onboarding Journey
```typescript
@WorkflowController({ taskQueue: 'user-onboarding' })
export class OnboardingWorkflowController {
  @WorkflowMethod()
  async onboardUser(userId: string): Promise<string> {
    // Multi-step onboarding with timeouts and retries
    await activities.sendWelcomeEmail(userId);
    await sleep('1 day'); // Temporal sleep
    await activities.sendFollowUpEmail(userId);
    await sleep('3 days');
    await activities.sendFeatureHighlights(userId);
    return 'onboarding-complete';
  }
}
```

## 📊 Monitoring & Health Checks

```typescript
@Injectable()
export class MonitoringService {
  constructor(private readonly temporal: TemporalService) {}

  async getSystemHealth() {
    // Comprehensive health status
    const health = await this.temporal.getOverallHealth();
    return {
      status: health.status, // 'healthy' | 'degraded' | 'unhealthy'
      components: health.components,
    };
  }

  async getDiscoveryInfo() {
    // What was discovered
    const workflows = this.temporal.getAvailableWorkflows();
    const schedules = this.temporal.getManagedSchedules();
    const stats = this.temporal.getDiscoveryStats();
    
    return { workflows, schedules, stats };
  }

  async manageSchedules() {
    // Schedule management
    await this.temporal.pauseSchedule('daily-report', 'Maintenance');
    await this.temporal.resumeSchedule('daily-report');
    await this.temporal.triggerSchedule('daily-report'); // Run now
  }
}
```

## 🌟 Why This Package?

- **🎯 NestJS First** - Built specifically for NestJS with familiar patterns
- **🔄 Auto-Discovery** - No manual registration, just use decorators
- **📅 Built-in Scheduling** - Cron jobs that integrate with workflows
- **🔧 Production Ready** - Health checks, monitoring, graceful shutdowns
- **📚 Easy to Learn** - Familiar NestJS controller patterns
- **🚀 Scalable** - Client-only, worker-only, or unified deployments

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
