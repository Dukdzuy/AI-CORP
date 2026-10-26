/**
 * Request DTOs for the projects module (HTTP boundary).
 * Business rules live in the domain entities; these only shape and pre-validate input.
 */

import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, Min, MinLength } from 'class-validator';

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

  /** Workflow template to run (Task 19); without one the default workflow runs */
  @IsOptional()
  @IsString()
  templateId?: string;

  /** Values for the template's parameters; defaults fill the rest */
  @IsOptional()
  @IsObject()
  templateParams?: Record<string, unknown>;
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
