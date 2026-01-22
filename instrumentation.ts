/**
 * OpenTelemetry Instrumentation for Next.js
 * 
 * This file is automatically loaded by Next.js 13.4+ for instrumentation.
 * It initializes OpenTelemetry SDK with manual instrumentation selection.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only register in Node.js runtime (server-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Check if tracing is enabled (default: disabled)
    const tracingEnabled = process.env.OTEL_TRACES_ENABLED === 'true';
    
    if (!tracingEnabled) {
      // Silently skip - don't log to avoid noise in production
      return;
    }

    try {
      // Use require for better compatibility with Next.js bundling
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Resource } = require('@opentelemetry/resources');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

      const serviceName = process.env.OTEL_SERVICE_NAME || 'bbq-franchise-platform';
      const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

      // Create OTLP exporter
      const traceExporter = new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
      });

      // Initialize the SDK with minimal instrumentations
      const sdk = new NodeSDK({
        resource: new Resource({
          [ATTR_SERVICE_NAME]: serviceName,
          [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          'deployment.environment': process.env.NODE_ENV || 'development',
        }),
        traceExporter,
        instrumentations: [
          new HttpInstrumentation({
            ignoreIncomingPaths: [
              /^\/_next\/.*/,
              /^\/favicon\.ico/,
              /^\/api\/health$/,
            ],
          }),
        ],
      });

      // Start the SDK
      sdk.start();

      console.log(`📊 OpenTelemetry initialized for ${serviceName}`);

      // Graceful shutdown
      process.on('SIGTERM', () => {
        sdk.shutdown()
          .then(() => console.log('📊 OpenTelemetry shut down successfully'))
          .catch((error: Error) => console.error('📊 Error shutting down OpenTelemetry', error))
          .finally(() => process.exit(0));
      });
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
    }
  }
}
