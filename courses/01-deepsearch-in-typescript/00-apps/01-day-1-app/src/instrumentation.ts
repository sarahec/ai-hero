import { env } from "~/env";
import { LangfuseExporter } from "langfuse-vercel";
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "ai-hero-chat",
    traceExporter: new LangfuseExporter({
      environment: env.NODE_ENV,
    }),
  });
}
