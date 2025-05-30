# NestJS Temporal Core

A comprehensive NestJS integration for [Temporal.io](https://temporal.io/) that provides seamless worker and client support with auto-discovery, declarative scheduling, and enterprise-ready features for building reliable distributed applications.

[![npm version](https://badge.fury.io/js/nestjs-temporal-core.svg)](https://badge.fury.io/js/nestjs-temporal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## 📚 Documentation

### Quick Links
- **[🚀 Getting Started](./docs/getting-started.md)** - Installation, basic setup, and first workflow
- **[⚙️ Configuration](./docs/configuration.md)** - Complete configuration reference and examples
- **[📖 API Reference](./docs/api-reference.md)** - Detailed API documentation for all services and decorators
- **[🍳 Examples & Recipes](./docs/examples.md)** - Practical examples and common patterns

## Overview

NestJS Temporal Core makes it easy to integrate Temporal.io with your NestJS applications using familiar decorator patterns. Temporal is a durable execution system for reliable microservices and workflow orchestration.

## ✨ Features

- 🚀 **Easy NestJS Integration** - Simple module registration with unified configuration
- 🎯 **Auto-Discovery** - Automatic discovery of workflow controllers and scheduled workflows
- 🔄 **Complete Lifecycle Management** - Automatic worker initialization and graceful shutdown
- 📋 **Declarative Decorators** - NestJS-style `@WorkflowController`, `@Cron`, `@Interval`, and more
- 🕐 **Smart Scheduling** - Built-in cron and interval-based workflow scheduling with management
- 🔌 **Connection Management** - Simplified connection handling with TLS and Temporal Cloud support
- 🔒 **Type Safety** - Clean, strongly typed interfaces for all Temporal concepts
- 📡 **Enhanced Client** - Methods for starting, signaling, and querying workflows with auto-discovery
- 📊 **Worker Management** - Advanced worker lifecycle control, monitoring, and health checks
- 🏭 **Production Ready** - Environment-aware configuration, health monitoring, and graceful degradation

## 🚀 Quick Start

### Installation

```bash
npm install nestjs-temporal-core @temporalio/client @temporalio/worker @temporalio/workflow
```

### Basic Setup

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

### Create a Workflow Controller

```typescript
import { WorkflowController, WorkflowMethod, Cron, Signal, Query } from 'nestjs-temporal-core';

@WorkflowController({ taskQueue: 'orders' })
export class OrderWorkflowController {
    private status = 'pending';
    
    @WorkflowMethod()
    async processOrder(orderId: string, customerId: string): Promise<string> {
        this.status = 'processing';
        // Workflow logic here
        this.status = 'completed';
        return this.status;
    }

    @Cron('0 8 * * *', {
        scheduleId: 'daily-order-report',
        description: 'Generate daily order report'
    })
    @WorkflowMethod()
    async generateDailyReport(): Promise<void> {
        console.log('Generating daily order report...');
    }

    @Signal('addItem')
    async addItemToOrder(item: any): Promise<void> {
        console.log('Item added to order:', item);
    }

    @Query('getStatus')
    getOrderStatus(): string {
        return this.status;
    }
}
```

### Use the Service

```typescript
import { Injectable } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class OrderService {
    constructor(private readonly temporalService: TemporalService) {}

    async processOrder(orderId: string, customerId: string): Promise<string> {
        const { workflowId } = await this.temporalService.startWorkflow(
            'processOrder',
            [orderId, customerId],
            { workflowId: `order-${orderId}` }
        );

        return workflowId;
    }
}
```

## 📖 Core Concepts

### Workflow Controllers
New NestJS-style controllers for defining workflows with auto-discovery and declarative scheduling.

### Activities  
Reusable business logic components that can be called from workflows.

### Scheduling
Built-in support for cron and interval-based workflow scheduling using decorators.

### Auto-Discovery
Automatic detection and registration of workflow controllers and scheduled workflows.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   NestJS App    │    │ Temporal Server  │    │  Worker Process │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Controllers │ │───▶│ │  Workflows   │ │───▶│ │ Activities  │ │
│ │   Services  │ │    │ │  Schedules   │ │    │ │  Workers    │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🎯 Use Cases

- **Order Processing** - Reliable order fulfillment with compensation
- **Payment Processing** - Multi-step payment flows with retries
- **Data Pipelines** - Long-running data processing workflows
- **Scheduled Jobs** - Cron-based and interval-based background tasks
- **Saga Patterns** - Distributed transaction management
- **Human Tasks** - Workflows requiring human intervention
- **Microservice Orchestration** - Coordinating multiple services

## 🌟 What's New in v3.0

- **🎮 Workflow Controllers** - NestJS-style workflow definition
- **📅 Declarative Scheduling** - `@Cron` and `@Interval` decorators
- **🔍 Auto-Discovery** - Automatic workflow and schedule detection
- **📊 Enhanced Monitoring** - Built-in health checks and metrics
- **🏭 Production Features** - Worker presets, graceful shutdown, error handling
- **🔧 Better Developer Experience** - Improved APIs and TypeScript support

## 📦 Packages

| Package                | Version                                                                                                             | Description              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `nestjs-temporal-core` | [![npm](https://img.shields.io/npm/v/nestjs-temporal-core.svg)](https://www.npmjs.com/package/nestjs-temporal-core) | Main integration package |
| `@temporalio/client`   | [![npm](https://img.shields.io/npm/v/@temporalio/client.svg)](https://www.npmjs.com/package/@temporalio/client)     | Temporal client library  |
| `@temporalio/worker`   | [![npm](https://img.shields.io/npm/v/@temporalio/worker.svg)](https://www.npmjs.com/package/@temporalio/worker)     | Temporal worker library  |
| `@temporalio/workflow` | [![npm](https://img.shields.io/npm/v/@temporalio/workflow.svg)](https://www.npmjs.com/package/@temporalio/workflow) | Workflow runtime library |

## 🤝 Community

- **GitHub Discussions** - Ask questions and share ideas
- **Issues** - Report bugs and request features  
- **Pull Requests** - Contribute to the project

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Harsh M** - [GitHub](https://github.com/harsh-simform)

## 🙏 Acknowledgments

- [Temporal.io](https://temporal.io/) - For the amazing workflow engine
- [NestJS](https://nestjs.com/) - For the incredible framework
- [TypeScript](https://www.typescriptlang.org/) - For making JavaScript enjoyable

---

**[📚 Continue to Getting Started →](./docs/getting-started.md)**