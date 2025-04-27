/**
 * Options for configuring Temporal Activity classes
 */
export interface ActivityOptions {
    /**
     * Optional name for the activity class
     * If not provided, the class name will be used
     */
    name?: string;
}

/**
 * Options for configuring Temporal Activity Methods
 */
export interface ActivityMethodOptions {
    /**
     * Custom name for the activity method
     * If not specified, the method name will be used
     */
    name?: string;

    /**
     * Optional timeout in milliseconds or formatted string (e.g. '30s')
     */
    timeout?: string | number;

    /**
     * Maximum number of retry attempts
     */
    maxRetries?: number;
}
