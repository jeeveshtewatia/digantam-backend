import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrmLoginDto {
    @ApiProperty({ example: 'employee@company.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Password@123' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
