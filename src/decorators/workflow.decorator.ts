import { SetMetadata } from '@nestjs/common';
import { TEMPORAL_QUERY_METHOD, TEMPORAL_SIGNAL_METHOD } from '../constants';
import { QueryOptions, SignalOptions } from '../interfaces';

/**
 * Marks a method as a Temporal Signal handler
 * Simplified version for workflow controllers
 *
 * @param nameOrOptions Signal name or options
 *
 * @example
 * ```typescript
 * @Signal('addItem')
 * async addItem(item: any) {
 *   // handle signal
 * }
 *
 * @Signal()  // Uses method name as signal name
 * async cancel() {
 *   // handle cancel signal
 * }
 * ```
 */
export const Signal = (nameOrOptions?: string | SignalOptions): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        let signalName: string;
        let signalOptions: SignalOptions = {};

        if (typeof nameOrOptions === 'string') {
            signalName = nameOrOptions;
            signalOptions = { name: nameOrOptions };
        } else if (nameOrOptions?.name) {
            signalName = nameOrOptions.name;
            signalOptions = nameOrOptions;
        } else {
            signalName = propertyKey.toString();
            signalOptions = { name: signalName };
        }

        const metadata = {
            name: signalName,
            ...signalOptions,
        };

        Reflect.defineMetadata(TEMPORAL_SIGNAL_METHOD, metadata, descriptor.value);
        SetMetadata(TEMPORAL_SIGNAL_METHOD, metadata)(descriptor.value);
        return descriptor;
    };
};

/**
 * Marks a method as a Temporal Query handler
 * Simplified version for workflow controllers
 *
 * @param nameOrOptions Query name or options
 *
 * @example
 * ```typescript
 * @Query('getStatus')
 * getOrderStatus(): string {
 *   return this.status;
 * }
 *
 * @Query()  // Uses method name as query name
 * getProgress(): number {
 *   return this.progress;
 * }
 * ```
 */
export const Query = (nameOrOptions?: string | QueryOptions): MethodDecorator => {
    return (_target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        let queryName: string;
        let queryOptions: QueryOptions = {};

        if (typeof nameOrOptions === 'string') {
            queryName = nameOrOptions;
            queryOptions = { name: nameOrOptions };
        } else if (nameOrOptions?.name) {
            queryName = nameOrOptions.name;
            queryOptions = nameOrOptions;
        } else {
            queryName = propertyKey.toString();
            queryOptions = { name: queryName };
        }

        const metadata = {
            name: queryName,
            ...queryOptions,
        };

        Reflect.defineMetadata(TEMPORAL_QUERY_METHOD, metadata, descriptor.value);
        SetMetadata(TEMPORAL_QUERY_METHOD, metadata)(descriptor.value);
        return descriptor;
    };
};
