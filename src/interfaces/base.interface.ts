/**
 * Base connection configuration for Temporal server
 */
export interface ConnectionOptions {
    /**
     * Temporal server address
     * Format: "host:port"
     * @example "localhost:7233"
     */
    address: string;

    /**
     * TLS configuration (optional)
     * If true, use TLS with default settings
     * If object, use detailed TLS configuration
     */
    tls?:
        | boolean
        | {
              /**
               * Server name for SNI (optional)
               */
              serverName?: string;

              /**
               * Certificate and key files as Buffer (for client auth)
               */
              clientCertPair?: {
                  crt: Buffer;
                  key: Buffer;
                  ca?: Buffer;
              };
          };

    /**
     * API key for Temporal Cloud (if applicable)
     */
    apiKey?: string;

    /**
     * Optional HTTP headers to send with each request
     */
    metadata?: Record<string, string>;
}
