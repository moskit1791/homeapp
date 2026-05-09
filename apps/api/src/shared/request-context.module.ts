import { Global, Module } from '@nestjs/common';
import { RequestContextStorage } from './request-context-storage';

@Global()
@Module({
  exports: [RequestContextStorage],
  providers: [RequestContextStorage]
})
export class RequestContextModule {}
