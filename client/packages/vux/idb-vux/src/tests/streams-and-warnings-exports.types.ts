// Compile-time export-surface checks for the stream/warning parity additions.
import type {
  CreateReadStreamOpts,
  CreateWriteStreamOpts,
  InstantReadableStream,
  InstantWritableStream,
  Logger,
} from '../index.js'
import { setInstantWarningsEnabled } from '../index.js'

const readOpts: CreateReadStreamOpts = {
  clientId: 'client-1',
}

const writeOpts: CreateWriteStreamOpts = {
  clientId: 'client-1',
}

declare const readStream: InstantReadableStream<string>
declare const writeStream: InstantWritableStream<string>
declare const logger: Logger

setInstantWarningsEnabled(true)

void readOpts
void writeOpts
void readStream
void writeStream
void logger
