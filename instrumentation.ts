/**
 * OpenTelemetry Instrumentation for Next.js
 * 
 * This file is automatically loaded by Next.js 13.4+ for instrumentation.
 * It initializes OpenTelemetry SDK with auto-instrumentation.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only register in Node.js runtime (server-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Check if tracing is enabled
    const tracingEnabled = process.env.OTEL_TRACES_ENABLED !== 'false';
    
    if (!tracingEnabled) {
      console.log('📊 OpenTelemetry tracing is disabled');
      return;
    }

    // Use require for better compatibility with Next.js bundling
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

    const serviceName = process.env.OTEL_SERVICE_NAME || 'bbq-franchise-platform';
    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    // Create OTLP exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    });

    // Initialize the SDK
    const sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable instrumentations that may cause issues with Next.js
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
          // Enable HTTP instrumentation for API routes
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            ignoreIncomingPaths: [
              // Ignore Next.js internal routes
              /^\/_next\/.*/,
              /^\/favicon\.ico/,
              /^\/api\/health$/,
            ],
          },
          // Enable fetch instrumentation for external API calls
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.log(`📊 OpenTelemetry initialized for ${serviceName}`);
    console.log(`   Exporting traces to: ${otlpEndpoint}`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('📊 OpenTelemetry shut down successfully'))
        .catch((error: Error) => console.error('📊 Error shutting down OpenTelemetry', error))
        .finally(() => process.exit(0));
    });
  }
}
