import { ApiProperty } from '@nestjs/swagger';

export class ExpenseEmailConfigDto {
  @ApiProperty()
  id?: number;

  @ApiProperty({ required: false })
  branchId?: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;

  @ApiProperty()
  imapHost: string;

  @ApiProperty()
  imapPort: number;

  @ApiProperty()
  imapSecure: boolean;

  @ApiProperty({ required: false })
  folder?: string;
}
