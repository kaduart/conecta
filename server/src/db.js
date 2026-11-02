import mongoose from 'mongoose';
import { config } from './config.js';
import { log } from './logger.js';

export async function conectar() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  log.info('mongo conectado');
  return mongoose;
}
