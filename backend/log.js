const winston = require("winston");

const isProduction = process.env.NODE_ENV == 'production';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YY/MM/DD HH:mm:ss' }),
  winston.format.printf(i => `${i.timestamp}|${i.level}\t${i.message}`)
);

const log = winston.createLogger({
  level: isProduction && 'warn' || 'verbose',
  format: format,
  transports: [
    //new winston.transports.File({ filename: 'logs/verbose.log', level: 'verbose' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
});

if (!isProduction) {
  log.add(new winston.transports.Console({
    level: 'verbose'
  }));
}

module.exports = log;