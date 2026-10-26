import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Permission, WebhookEventName } from '@ai-corp/shared-types';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI pipeline' })
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: Permission, isArray: true, example: [Permission.PROJECT_READ, Permission.PROJECT_CREATE] })
  @IsArray() @ArrayNotEmpty() @IsIn(Object.values(Permission), { each: true })
  scopes!: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional() @IsInt() @Min(1) @Max(365)
  expiresInDays?: number;
}

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/hooks/ai-corp' })
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  url!: string;

  @ApiProperty({ enum: WebhookEventName, isArray: true })
  @IsArray() @ArrayNotEmpty() @IsIn(Object.values(WebhookEventName), { each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Only events of this project; omit for every project' })
  @IsOptional() @IsString()
  projectId?: string;
}

/** Project creation through the integration API (same rules as the web form) */
export class IntegrationCreateProjectDto {
  @ApiProperty({ minLength: 3 }) @IsString() @MinLength(3) @MaxLength(200)
  name!: string;

  @ApiProperty() @IsString() @MinLength(1)
  description!: string;

  @ApiProperty({ minLength: 20 }) @IsString() @MinLength(20)
  goal!: string;

  @ApiPropertyOptional({ description: 'USD', minimum: 1 }) @IsOptional() @IsNumber() @Min(1)
  budget?: number;

  @ApiPropertyOptional({ example: 'ooad-software-project' }) @IsOptional() @IsString()
  templateId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) @IsOptional() @IsObject()
  templateParams?: Record<string, unknown>;
}
