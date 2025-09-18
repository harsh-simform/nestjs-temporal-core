# GitHub Copilot Instructions for NestJS Temporal Core

## 🚀 Project Overview

**NestJS Temporal Core** is a comprehensive integration framework that bridges NestJS and Temporal.io, enabling developers to build robust, distributed, fault-tolerant applications using Temporal's workflow orchestration engine with NestJS's powerful dependency injection and modular architecture.

### 🎯 What We're Building

This framework provides:
- **Seamless Integration**: Native NestJS decorators and services for Temporal workflows
- **Enterprise-Ready**: Production-grade error handling, monitoring, and health checks
- **Developer Experience**: Type-safe decorators, automatic discovery, and comprehensive logging
- **Scalable Architecture**: Modular design supporting complex distributed systems
- **Zero Configuration**: Smart defaults with extensive customization options

### 🏗️ Core Architecture Components

#### **Framework Layers:**

1. **Decorator Layer** (`src/decorators/`)
   - `@Activity()` - Mark classes/methods as Temporal activities
   - `@Workflow()` - Define Temporal workflows with NestJS integration
   - `@Signal()` - Handle workflow signals
   - `@Query()` - Implement workflow queries
   - `@Schedule()` - Configure scheduled workflows
   - `@ChildWorkflow()` - Manage child workflow relationships

2. **Service Layer** (`src/services/`)
   - `TemporalService` - Unified facade for all Temporal operations
   - `TemporalClientService` - Workflow execution and management
   - `TemporalWorkerService` - Worker lifecycle and activity registration
   - `TemporalActivityService` - Activity discovery and execution
   - `TemporalScheduleService` - Schedule management (cron, interval, calendar)
   - `TemporalDiscoveryService` - Automatic component discovery
   - `TemporalMetadataService` - Metadata extraction and validation

3. **Module Layer** (`src/`)
   - `TemporalModule` - Main module for application integration
   - Configuration interfaces and type definitions
   - Health monitoring and status reporting

4. **Utility Layer** (`src/utils/`)
   - Logger utilities with structured logging
   - Validation helpers and type guards
   - Connection factories and management

### 🔧 Key Features & Capabilities

#### **Decorator-Based Development**
```typescript
@Injectable()
@Activity('processPayment')
export class PaymentActivity {
  async execute(amount: number, currency: string): Promise<PaymentResult> {
    // Activity implementation
  }
}

@Injectable()
@Workflow('paymentWorkflow')
export class PaymentWorkflow {
  @Signal('cancelPayment')
  async cancelPayment(): Promise<void> {
    // Signal handler
  }

  @Query('getPaymentStatus')
  getStatus(): PaymentStatus {
    // Query handler
  }
}
```

#### **Automatic Service Discovery**
- Runtime discovery of decorated classes and methods
- Automatic registration with Temporal workers
- Type-safe metadata extraction and validation
- Component health monitoring and status reporting

#### **Advanced Scheduling**
```typescript
@Schedule({
  cronExpressions: ['0 0 * * MON'],
  timeZone: 'UTC',
  overlap: ScheduleOverlapPolicy.SKIP
})
export class WeeklyReportWorkflow {
  // Scheduled workflow implementation
}
```

#### **Comprehensive Error Handling**
- Structured error propagation
- Activity and workflow failure recovery
- Dead letter queue management
- Detailed error logging and monitoring

#### **Enterprise Features**
- Health checks and metrics
- Connection pooling and management
- Multi-environment configuration
- Graceful shutdown handling
- Performance monitoring

### 🏛️ Project Structure

```
src/
├── decorators/           # Framework decorators
│   ├── activity.decorator.ts
│   ├── workflow.decorator.ts
│   ├── signal.decorator.ts
│   ├── query.decorator.ts
│   └── schedule.decorator.ts
├── services/            # Core services
│   ├── temporal.service.ts
│   ├── temporal-client.service.ts
│   ├── temporal-worker.service.ts
│   ├── temporal-activity.service.ts
│   ├── temporal-schedule.service.ts
│   ├── temporal-discovery.service.ts
│   └── temporal-metadata.service.ts
├── health/              # Health monitoring
│   ├── temporal-health.controller.ts
│   └── temporal-health.module.ts
├── providers/           # Configuration providers
├── utils/               # Utilities and helpers
├── types/               # TypeScript definitions
├── interfaces.ts        # Core interfaces
├── constants.ts         # Framework constants
└── temporal.module.ts   # Main module
```

### 🎯 Development Principles

#### **Type Safety First**
- Comprehensive TypeScript coverage
- Strict type checking enabled
- Interface-driven development
- Generic types for workflow/activity definitions

#### **NestJS Best Practices**
- Dependency injection throughout
- Module-based architecture
- Lifecycle hooks integration
- Exception filters and interceptors

#### **Temporal.io Integration**
- Native Temporal SDK usage
- Workflow determinism preservation
- Activity idempotency support
- Signal and query handling

#### **Testing Excellence**
- Unit tests for all services
- Integration tests for workflows
- Mocking strategies for external dependencies
- Coverage-driven development

## 📋 Current Development Focus: Quality & Test Excellence

### Overview
The project maintains a strong focus on code quality, comprehensive testing, and continuous improvement. Our testing strategy ensures:
- Code reliability and maintainability
- Comprehensive error scenario coverage
- Production-ready quality standards
- Enterprise-grade service excellence

### Testing Strategy
The framework employs a multi-layered testing approach:
- **Unit Tests**: Comprehensive coverage for all services and utilities
- **Integration Tests**: End-to-end workflow and activity testing
- **Performance Tests**: Load testing for high-throughput scenarios
- **Error Scenario Testing**: Comprehensive failure mode coverage

*Note: Current test coverage status can be obtained by running `npm run test`*

### 📋 **Testing Patterns Established**

1. **Comprehensive Mock Setup**: All external dependencies properly mocked
2. **Error Handling Coverage**: Every try-catch block tested with error scenarios
3. **Edge Case Testing**: Null/undefined inputs, invalid parameters, boundary conditions
4. **Branch Coverage**: All conditional logic paths covered
5. **Private Method Testing**: Accessing private methods via `(service as any)` for complete coverage
6. **Cache Management**: Testing internal caching mechanisms where applicable

### 🛠 **Development Guidelines**

#### When Working on Service Tests:

1. **Follow Established Patterns**:
   ```typescript
   // Standard test structure
   describe('ServiceName', () => {
     let service: ServiceName;
     let mockDependency: jest.Mocked<DependencyType>;

     beforeEach(async () => {
       // Setup mocks and module
     });

     afterEach(() => {
       jest.restoreAllMocks();
     });
   });
   ```

2. **Mock External Dependencies**:
   ```typescript
   const mockClient = {
     workflow: { start: jest.fn(), getHandle: jest.fn() },
     connection: { close: jest.fn() }
   } as any;
   ```

3. **Test Error Scenarios**:
   ```typescript
   it('should handle errors gracefully', async () => {
     mockDependency.method.mockRejectedValue(new Error('Test error'));
     // Suppress logger if needed
     const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
     
     await expect(service.method()).rejects.toThrow();
     loggerSpy.mockRestore();
   });
   ```

4. **Cover All Branches**:
   - Test both success and failure paths
   - Test all conditional statements (if/else, switch cases)
   - Test array/object property existence checks
   - Test different parameter combinations

### 🔍 **Key Implementation Details**

#### Common Patterns:
- All services use `createLogger()` from utils for consistent logging
- Error handling follows try-catch patterns with logger integration
- Services implement lifecycle hooks (OnModuleInit, OnModuleDestroy)
- Dependency injection through NestJS module system

###  **Tips for Copilot**

- Focus on one service at a time for systematic progress
- Always check actual implementation before writing tests
- Use `jest.spyOn` for mocking internal dependencies
- Test private methods using `(service as any)` pattern
- Maintain consistency with established test file structure
- Verify test changes don't break existing functionality

---

*Last Updated: September 18, 2025*
*Current Branch: feat/improvements*
*Project: nestjs-temporal-core by harsh-simform*