# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.12] - 2025-11-07

### Added
- **Multiple Workers Support**: Configure and manage multiple workers with different task queues in the same process
- New `workers` array property in `TemporalOptions` for defining multiple worker configurations
- `getAllWorkers()`: Get information about all registered workers
- `getWorker(taskQueue)`: Get a specific worker by task queue name
- `getWorkerStatusByTaskQueue(taskQueue)`: Get status of a specific worker
- `startWorkerByTaskQueue(taskQueue)`: Start a specific worker
- `stopWorkerByTaskQueue(taskQueue)`: Stop a specific worker
- `registerWorker(workerDef)`: Dynamically register new workers at runtime
- `getWorkerManager()`: Access worker manager service
- `getConnection()`: Access native Temporal connection for custom worker creation
- New interfaces: `WorkerDefinition`, `MultipleWorkersInfo`, `CreateWorkerResult`, `WorkerInstance`
- Comprehensive migration guide in README for upgrading from single to multiple workers
- Documentation for manual worker creation using native Temporal SDK

### Changed
- Refactored `TemporalWorkerManagerService` to support both legacy single worker and new multiple workers
- Enhanced worker lifecycle management with per-worker state tracking
- Improved worker initialization with better error handling
- All interfaces consolidated in `src/interfaces.ts` (moved `WorkerInstance` from service file)

### Fixed
- No breaking changes - fully backward compatible with v3.0.11
- Legacy single worker configuration continues to work without modifications

## [3.0.11] - 2025-11-01

### Fixed
- Improved stability and error handling
- Enhanced logging for better debugging

## [3.0.10] - 2025-10-15

### Added
- Enhanced monitoring capabilities
- Improved health check endpoints

### Changed
- Updated internal architecture for better performance

## [3.0.0] - 2025-09-01

### Added
- Complete rewrite with modular architecture
- Auto-discovery of activities via decorators
- Enhanced monitoring and health checks
- Comprehensive TypeScript support
- Production-ready error handling

### Changed
- Breaking changes from v2.x - see migration guide

## [2.x] - Historical Versions

See previous releases for v2.x changelog.

---

## Migration Guide

### Upgrading from 3.0.11 to 3.0.12

No breaking changes. All existing code continues to work. See README.md for new multiple workers features.

### Upgrading from 3.0.10 to 3.0.11

No breaking changes. Minor improvements and bug fixes.

### Upgrading from 2.x to 3.x

Major rewrite - see full migration guide in documentation.
