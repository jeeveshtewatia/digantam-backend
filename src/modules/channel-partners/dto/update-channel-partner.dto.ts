import { PartialType } from '@nestjs/swagger';
import { CreateChannelPartnerDto } from './create-channel-partner.dto';

export class UpdateChannelPartnerDto extends PartialType(CreateChannelPartnerDto) {}
