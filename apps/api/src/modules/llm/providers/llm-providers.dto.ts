import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MODEL_CATEGORIES, PROVIDER_KINDS } from '../../../domain/llm';

export class CreateLlmProviderDto {
  @ApiProperty({ example: 'OpenRouter' })
  @IsString() @MinLength(1) @MaxLength(60)
  name!: string;

  @ApiProperty({ enum: PROVIDER_KINDS })
  @IsIn(PROVIDER_KINDS)
  kind!: string;

  @ApiPropertyOptional({ example: 'https://openrouter.ai/api/v1', description: 'Empty uses the kind\'s default' })
  @IsOptional() @IsString() @MaxLength(300)
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Stored encrypted, never returned' })
  @IsOptional() @IsString() @MaxLength(500)
  apiKey?: string;
}

export class UpdateLlmProviderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ enum: PROVIDER_KINDS }) @IsOptional() @IsIn(PROVIDER_KINDS)
  kind?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Empty or omitted keeps the stored key' })
  @IsOptional() @IsString() @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ description: 'true removes the stored key' }) @IsOptional() @IsBoolean()
  clearApiKey?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isEnabled?: boolean;
}

export class AddLlmModelDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString() @MinLength(1) @MaxLength(200)
  modelId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ enum: MODEL_CATEGORIES }) @IsOptional() @IsIn([...MODEL_CATEGORIES])
  category?: string;
}

export class AddLlmModelsDto {
  @ApiProperty({ type: [AddLlmModelDto] })
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => AddLlmModelDto)
  models!: AddLlmModelDto[];

  @ApiPropertyOptional({ description: 'true when picked from the provider\'s own model list' })
  @IsOptional() @IsBoolean()
  fromProvider?: boolean;
}

export class UpdateLlmModelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ enum: MODEL_CATEGORIES }) @IsOptional() @IsIn([...MODEL_CATEGORIES])
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isEnabled?: boolean;
}

export class AssignAgentModelDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString() @MinLength(1) @MaxLength(200)
  model!: string;

  @ApiPropertyOptional({ description: 'Configured provider; omit for the NINE_ROUTER_URL gateway' })
  @IsOptional() @IsString()
  providerId?: string;
}
