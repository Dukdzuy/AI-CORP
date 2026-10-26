/**
 * Request DTOs for the projects module (HTTP boundary).
 * Business rules live in the domain entities; these only shape and pre-validate input.
 */

import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  goal!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  budget?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  goal?: string;
}

export interface CreateTaskDto {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  milestoneId?: string;
}

export interface UpdateTaskDto {
  status?: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignedAgent?: string;
}

export interface CreateMilestoneDto {
  name: string;
  description: string;
  dueDate?: string | Date;
}

export interface UpdateMilestoneDto {
  status?: string;
  name?: string;
  description?: string;
  dueDate?: string | Date | null;
}
