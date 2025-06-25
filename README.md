# NestJS Temporal Core

A comprehensive NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless workflow orchestration with auto-discovery, declarative scheduling, and production-ready features.

[![npm version](https://badge.fury.io/js/nestjs-temporal-core.svg)](https://badge.fury.io/js/nestjs-temporal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Overview

NestJS Temporal Core brings Temporal's durable execution to NestJS with familiar decorator patterns and automatic discovery. Build reliable distributed systems with activities and scheduled tasks using native NestJS conventions.

## 🚀 Key Features

- **🎯 NestJS-Native** - Familiar patterns: `@Activity`, `@Cron`, `@Interval`
- **🔍 Auto-Discovery** - Automatically finds and registers activities and schedules
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

### 3. Create Scheduled Workflows

```typescript
// services/scheduled.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, Interval } from 'nestjs-temporal-core';

@Injectable()
export class ScheduledService {
  // Automatic scheduling - runs at 9 AM daily
  @Cron('0 9 * * *', { 
    scheduleId: 'daily-user-report',
    description: 'Generate daily user report'
  })
  async generateDailyReport(): Promise<void> {
    console.log('Generating daily user report...');
    // Report generation logic
  }

  // Interval-based scheduling - runs every hour
  @Interval('1h', {
    scheduleId: 'hourly-cleanup',
    description: 'Hourly cleanup task'
  })
  async cleanupTask(): Promise<void> {
    console.log('Running cleanup task...');
    // Cleanup logic
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

  async processUser(email: string, name: string): Promise<string> {
    // Start workflow directly with client
    const { workflowId } = await this.temporal.startWorkflow(
      'processUser', 
      [email, name],
      { 
        taskQueue: 'user-processing',
        workflowId: `user-${email}-${Date.now()}` 
      }
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
- **Activity Classes** marked with `@Activity` 
- **Scheduled Workflows** marked with `@Cron` or `@Interval`
- **Signals and Queries** within classes

### Scheduling Made Simple
```typescript
// Just add the decorator - schedule is created automatically!
@Cron('0 8 * * *', { scheduleId: 'daily-report' })
async generateReport(): Promise<void> {
  // This will run every day at 8 AM
}
```

## 🔧 Common Use Cases

### Scheduled Reports
```typescript
@Injectable()
export class ReportService {
  @Cron('0 0 * * 0', { scheduleId: 'weekly-sales-report' })
  async generateWeeklySalesReport(): Promise<void> {
    // Automatically runs every Sunday at midnight
    console.log('Generating weekly sales report...');
  }
}
```

### Data Processing
```typescript
@Injectable()
@Activity()
export class DataProcessingActivities {
  @ActivityMethod()
  async processFile(filePath: string): Promise<string> {
    console.log(`Processing file: ${filePath}`);
    // File processing logic
    return 'processed';
  }

  @ActivityMethod()
  async sendNotification(message: string): Promise<void> {
    console.log(`Sending notification: ${message}`);
    // Notification logic
  }
}
```

### Monitoring Tasks
```typescript
@Injectable()
export class MonitoringService {
  @Interval('5m', {
    scheduleId: 'health-check',
    description: 'Health check every 5 minutes'
  })
  async healthCheck(): Promise<void> {
    console.log('Running health check...');
    // Health check logic
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
    const schedules = this.temporal.getManagedSchedules();
    const stats = this.temporal.getDiscoveryStats();
    
    return { schedules, stats };
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
- **📚 Easy to Learn** - Familiar NestJS service patterns
- **🚀 Scalable** - Client-only, worker-only, or unified deployments

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.