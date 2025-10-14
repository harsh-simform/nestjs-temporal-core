import { TEMPORAL_ACTIVITY, TEMPORAL_ACTIVITY_METHOD } from '../constants';
import { ActivityMethodOptions, ActivityOptions } from '../interfaces';
import { createLogger } from '../utils/logger';

const logger = createLogger('ActivityDecorators');

/**
 * Activity decorator for marking classes as Temporal activities
 *
 * @param options Activity configuration options
 *
 * @example
 * ```typescript
 * @Activity({ name: 'email-activities' })
 * export class EmailActivities {
 *   @ActivityMethod('sendEmail')
 *   async sendEmail(to: string, subject: string, body: string): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export const Activity = (options?: ActivityOptions): ClassDecorator => {
    return (target: unknown) => {
        const targetClass = target as Function;
        const activityName = options?.name || targetClass.name;

        logger.debug(`@Activity decorator applied to class: ${targetClass.name}`);
        logger.debug(`Activity name: ${activityName}`);
        logger.debug(`Activity options: ${JSON.stringify(options)}`);

        const metadata = {
            name: activityName,
            className: targetClass.name,
            ...options,
        };

        logger.debug(
            `Storing activity metadata for ${targetClass.name}: ${JSON.stringify(metadata)}`,
        );

        try {
            // Standardized metadata storage - only use Reflect.defineMetadata
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, metadata, targetClass);
            logger.debug(`Stored activity metadata on class constructor: ${targetClass.name}`);

            // Store on prototype for discovery service compatibility
            Reflect.defineMetadata(TEMPORAL_ACTIVITY, metadata, targetClass.prototype);
            logger.debug(`Stored activity metadata on class prototype: ${targetClass.name}`);

            logger.debug(`@Activity decorator successfully applied to ${targetClass.name}`);
        } catch (error) {
            logger.error(`Failed to apply @Activity decorator to ${targetClass.name}:`, error);
            throw error;
        }

        return target as never;
    };
};

/**
 * Activity method decorator for marking methods as Temporal activity methods
 *
 * @param nameOrOptions Activity name or configuration options
 *
 * @example
 * ```typescript
 * // Using method name as activity name
 * @ActivityMethod()
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 *
 * // Using custom activity name
 * @ActivityMethod('process-order')
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 *
 * // Using options object
 * @ActivityMethod({
 *   name: 'process-order',
 *   timeout: '5m',
 *   maxRetries: 3
 * })
 * async processOrder(orderId: string): Promise<void> {
 *   // Implementation
 * }
 * ```
 */
export const ActivityMethod = (nameOrOptions?: string | ActivityMethodOptions): MethodDecorator => {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor?: PropertyDescriptor,
    ): PropertyDescriptor | void => {
        const className = target.constructor.name;
        const methodName = propertyKey.toString();

        logger.debug(`@ActivityMethod decorator applied to method: ${className}.${methodName}`);
        logger.debug(`ActivityMethod nameOrOptions: ${JSON.stringify(nameOrOptions)}`);

        let activityName: string;
        let methodOptions: ActivityMethodOptions = {};

        // Parse name and options
        if (typeof nameOrOptions === 'string') {
            activityName = nameOrOptions;
            methodOptions = { name: activityName };
            logger.debug(`Using provided string name: ${activityName}`);
        } else if (
            nameOrOptions &&
            typeof nameOrOptions.name === 'string' &&
            nameOrOptions.name.trim().length > 0
        ) {
            activityName = nameOrOptions.name;
            methodOptions = { ...nameOrOptions };
            logger.debug(`Using name from options object: ${activityName}`);
        } else if (nameOrOptions && nameOrOptions.name === '') {
            // Handle explicit empty name - should throw error
            activityName = '';
            methodOptions = { ...nameOrOptions };
            logger.debug(`Explicit empty name provided`);
        } else if (nameOrOptions && !nameOrOptions.name) {
            // Handle options object without name property
            activityName = methodName;
            methodOptions = { name: activityName, ...nameOrOptions };
            logger.debug(`Using method name as activity name: ${activityName}`);
        } else {
            activityName = methodName;
            methodOptions = { name: activityName };
            logger.debug(`Auto-generated activity name from method name: ${activityName}`);
        }

        // Validate activity name
        if (!activityName || activityName.trim().length === 0) {
            const error = 'Activity name cannot be empty';
            logger.error(
                `@ActivityMethod validation failed for ${className}.${methodName}: ${error}`,
            );
            throw new Error(error);
        }

        logger.verbose(
            `Activity name resolved to: "${activityName}" for method ${className}.${methodName}`,
        );

        const metadata = {
            name: activityName,
            methodName,
            className,
            ...methodOptions,
        };

        logger.debug(
            `Final activity metadata for ${className}.${methodName}: ${JSON.stringify(metadata)}`,
        );

        try {
            if (descriptor?.value && typeof descriptor.value === 'function') {
                logger.debug(
                    `Storing @ActivityMethod metadata on method function: ${className}.${methodName}`,
                );

                // Standardized metadata storage - only use Reflect.defineMetadata
                Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD, metadata, descriptor.value);
                logger.debug(
                    `Stored activity method metadata on method function: ${className}.${methodName}`,
                );

                // Store on class prototype for discovery
                const activityMethods =
                    Reflect.getMetadata(TEMPORAL_ACTIVITY_METHOD, target.constructor.prototype) ||
                    {};
                activityMethods[methodName] = metadata;
                Reflect.defineMetadata(
                    TEMPORAL_ACTIVITY_METHOD,
                    activityMethods,
                    target.constructor.prototype,
                );
                logger.debug(`Stored activity method metadata on class prototype: ${className}`);
                logger.debug(
                    `Total activity methods on ${className}: ${Object.keys(activityMethods).length}`,
                );

                logger.debug(
                    `@ActivityMethod decorator successfully applied to ${className}.${methodName}`,
                );
                return descriptor;
            } else {
                logger.debug(`Handling property-style decorator for ${className}.${methodName}`);
                // Handle property-style decorators (fallback)
                Reflect.defineMetadata(TEMPORAL_ACTIVITY_METHOD, metadata, target, propertyKey);
                logger.debug(
                    `Stored activity method metadata on property: ${className}.${methodName}`,
                );
            }
        } catch (error) {
            logger.error(
                `Failed to apply @ActivityMethod decorator to ${className}.${methodName}:`,
                error,
            );
            throw error;
        }
    };
};
