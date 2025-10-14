# GitHub Copilot Instructions for NestJS Temporal Core

## 🚀 Project Overview

**NestJS Temporal Core** is a comprehensive integration framework that bridges NestJS and Temporal.io, enabling developers to build robust, distributed, fault-tolerant applications using Temporal's workflow orchestration engine with NestJS's powerful dependency injection and modular architecture.

### 🎯 What We're Building

This framework provides:
- **Modular Architecture**: Separate modules for client, worker, activities, and schedules
- **Enterprise-Ready**: Production-grade error handling, monitoring, and health checks
- **Developer Experience**: Type-safe decorators, automatic discovery, and comprehensive logging
- **Scalable Integration**: Flexible registration patterns for different deployment scenarios
- **Zero Configuration**: Smart defaults with extensive customization options

### 🏗️ Current Architecture (Post-3.0 Refactor)

#### **Modular Module System:**

1. **Core Modules** (`src/`)
   - `TemporalModule` - Main unified module with client + worker integration
   - `TemporalClientModule` - Client-only operations (workflow execution, queries)
   - `TemporalWorkerModule` - Worker-only operations (activity/workflow registration)
   - `TemporalActivityModule` - Standalone activity management
   - `TemporalSchedulesModule` - Standalone schedule management

2. **Service Layer** (`src/services/`)
   - `TemporalService` - Unified facade for all Temporal operations
   - `TemporalClientService` - Workflow execution and management
   - `TemporalWorkerManagerService` - Worker lifecycle and activity registration  
   - `TemporalScheduleService` - Schedule management (cron, interval, calendar)
   - `TemporalDiscoveryService` - Automatic component discovery
   - `TemporalMetadataAccessor` - Metadata extraction and validation

3. **Decorator Layer** (`src/decorators/`)
   - `@Activity()` - Mark classes as Temporal activities
   - `@ActivityMethod()` - Mark methods for activity discovery
   - Workflow decorators (deprecated - use pure Temporal workflow functions)

4. **Provider Layer** (`src/providers/`)
   - `TemporalConnectionFactory` - Connection management and pooling
   - Configuration providers and constants

### 🔧 Key Integration Patterns

#### **Module Registration Patterns**
```typescript
// 1. Unified Module (Client + Worker)
TemporalModule.register({
  connection: { address: 'localhost:7233' },
  taskQueue: 'my-queue',
  worker: { 
    workflowsPath: './dist/workflows',
    activityClasses: [PaymentActivity] 
  }
})

// 2. Client-Only Module
TemporalClientModule.register({
  connection: { address: 'localhost:7233' }
})

// 3. Worker-Only Module  
TemporalWorkerModule.register({
  connection: { address: 'localhost:7233' },
  taskQueue: 'worker-queue',
  worker: { workflowsPath: './dist/workflows' }
})

// 4. Async Configuration
TemporalModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    connection: { address: config.get('TEMPORAL_ADDRESS') },
    taskQueue: config.get('TEMPORAL_TASK_QUEUE')
  }),
  inject: [ConfigService]
})
```

#### **Activity Development**
```typescript
@Injectable()
@Activity({ name: 'payment-activities' })
export class PaymentActivity {
  @ActivityMethod('processPayment')
  async processPayment(amount: number): Promise<PaymentResult> {
    // Activity implementation with full NestJS DI support
  }
}
```

#### **Service Integration**
```typescript
@Injectable()
export class OrderService {
  constructor(private temporal: TemporalService) {}

  async processOrder(orderId: string) {
    // Start workflow
    const { workflowId } = await this.temporal.startWorkflow(
      'processOrder', [orderId], { workflowId: `order-${orderId}` }
    );
    
    // Query status
    const status = await this.temporal.queryWorkflow(workflowId, 'getStatus');
    
    // Send signal  
    await this.temporal.signalWorkflow(workflowId, 'cancel', ['user-request']);
  }
}
```

### 🏛️ Project Structure

```
src/
├── temporal.module.ts           # Main unified module
├── interfaces.ts               # Core TypeScript interfaces
├── constants.ts               # Framework constants
├── index.ts                   # Public API exports
├── decorators/               # Activity/workflow decorators
│   └── activity.decorator.ts
├── services/                # Core service layer
│   ├── temporal.service.ts           # Unified facade service
│   ├── temporal-client.service.ts    # Client operations
│   ├── temporal-worker.service.ts    # Worker management
│   ├── temporal-schedule.service.ts  # Schedule management  
│   ├── temporal-discovery.service.ts # Component discovery
│   └── temporal-metadata.service.ts  # Metadata extraction
├── client/                  # Client-only module
│   └── temporal-client.module.ts
├── worker/                  # Worker-only module
│   └── temporal-worker.module.ts
├── activity/               # Activity-only module
│   ├── temporal-activity.module.ts
│   └── temporal-activity.service.ts
├── schedules/              # Schedule-only module
│   ├── temporal-schedules.module.ts
│   └── temporal-schedules.service.ts
├── health/                 # Health monitoring
│   ├── temporal-health.controller.ts
│   └── temporal-health.module.ts
├── providers/             # Connection providers
│   └── temporal-connection.factory.ts
├── utils/                 # Utilities and helpers
│   ├── logger.ts         # Logging utilities
│   └── validation.ts     # Validation helpers
└── types/                # TypeScript type definitions
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

## 🔍 **Essential Commands & Workflows**

### **Development Commands**
```bash
# Testing & Quality
npm run test              # Run all tests with coverage
npm run test:unit         # Unit tests only  
npm run test:ci           # CI pipeline tests
npm run fix-all           # Format + lint fix

# Build & Release
npm run build             # Clean build
npm run release           # Build + publish
npm run release:dry       # Test release

# Documentation
npm run docs:generate     # Generate API docs
npm run docs:serve        # Serve docs locally
```

### **Testing Patterns**
- **Coverage Target**: 90% branches/functions/lines/statements
- **Mock Pattern**: Use `jest.spyOn((service as any).methodName)` for private methods
- **Error Testing**: Always test error scenarios with logger suppression
- **Setup**: Standard `beforeEach`/`afterEach` with `jest.restoreAllMocks()`

---

*Last Updated: September 24, 2025*
*Current Branch: feat/improvements*
*Project: nestjs-temporal-core by harsh-simform*