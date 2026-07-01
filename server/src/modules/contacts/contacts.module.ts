import { Module } from '@nestjs/common';
import { ContactMatcherService } from './contact-matcher.service';

@Module({
  providers: [ContactMatcherService],
  exports: [ContactMatcherService],
})
export class ContactsModule {}
