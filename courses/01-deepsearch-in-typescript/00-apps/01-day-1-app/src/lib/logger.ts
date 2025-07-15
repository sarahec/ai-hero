import winston from "winston";

const { combine, timestamp, printf, colorize, align } = winston.format;

const fileTransport = new winston.transports.File({
  filename: "app.log",
  level: "debug",
  format: combine(
    timestamp(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
});

const consoleTransport = new winston.transports.Console({
  level: "debug",
  format: combine(
    colorize(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [fileTransport],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(consoleTransport);
}

export default logger;
