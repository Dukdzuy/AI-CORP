import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentRole, ToolDefinition, ToolRoleAccess } from '@ai-corp/shared-types';

/**
 * ToolRegistry
 *
 * Manages tool registration and role-based access control for agent tools.
 * Provides methods to register tools, retrieve specific tools, and filter tools by agent role.
 *
 * Implements Requirement 18: Tool Registry and Role-Based Access Control
 */
@Injectable()
export class ToolRegistry {
  // Map of tool name to tool definition
  private tools: Map<string, ToolDefinition> = new Map();

  // Map of tool name to allowed agent roles
  private toolRoleAccess: Map<string, AgentRole[]> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  /**
   * Register a new tool with role-based access control
   *
   * Validates tool definition and stores it along with access control mapping.
   * Throws error if tool with same name already exists or if input is invalid.
   *
   * @param tool - Tool definition containing name, description, parameters, etc.
   * @param allowedRoles - Agent roles that are authorized to execute this tool
   * @throws BadRequestException if tool is invalid or already registered
   */
  registerTool(tool: ToolDefinition, allowedRoles: AgentRole[]): void {
    // Validate tool definition
    if (!tool || !tool.name || !tool.name.trim()) {
      throw new BadRequestException('Tool must have a valid name');
    }

    if (this.tools.has(tool.name)) {
      throw new BadRequestException(`Tool '${tool.name}' is already registered`);
    }

    if (!tool.description || !tool.description.trim()) {
      throw new BadRequestException(`Tool '${tool.name}' must have a description`);
    }

    if (!tool.parameters) {
      throw new BadRequestException(`Tool '${tool.name}' must have parameters schema`);
    }

    // Validate allowed roles
    if (!allowedRoles || allowedRoles.length === 0) {
      throw new BadRequestException(
        `Tool '${tool.name}' must have at least one allowed role`
      );
    }

    // Validate all roles are valid AgentRole enum values
    const validRoles = Object.values(AgentRole);
    for (const role of allowedRoles) {
      if (!validRoles.includes(role)) {
        throw new BadRequestException(`Invalid agent role: ${role}`);
      }
    }

    // Set default values for optional fields
    const toolDef: ToolDefinition = {
      ...tool,
      requiresSandbox: tool.requiresSandbox ?? false,
      timeout: tool.timeout ?? 30000, // Default 30 seconds
      resourceLimits: tool.resourceLimits ?? {
        maxMemoryMB: 512,
        maxCPUPercent: 50,
        maxDiskMB: 1024,
      },
    };

    // Store tool and access control mapping
    this.tools.set(tool.name, toolDef);
    this.toolRoleAccess.set(tool.name, allowedRoles);
  }

  /**
   * Retrieve a tool by name
   *
   * @param name - Tool name to retrieve
   * @returns Tool definition if found, undefined otherwise
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools available for a specific agent role
   *
   * Filters and returns only tools that the specified agent role is authorized to execute.
   * Validates that agentRole is a valid AgentRole enum value.
   *
   * @param agentRole - Agent role to filter tools for
   * @returns Array of tool definitions available to the agent role
   * @throws BadRequestException if agentRole is invalid
   */
  getToolsForAgent(agentRole: AgentRole): ToolDefinition[] {
    // Validate role
    const validRoles = Object.values(AgentRole);
    if (!validRoles.includes(agentRole)) {
      throw new BadRequestException(`Invalid agent role: ${agentRole}`);
    }

    const toolsForAgent: ToolDefinition[] = [];

    // Iterate through all registered tools and check if role has access
    for (const [toolName, roles] of this.toolRoleAccess.entries()) {
      if (roles.includes(agentRole)) {
        const toolDef = this.tools.get(toolName);
        if (toolDef) {
          toolsForAgent.push(toolDef);
        }
      }
    }

    return toolsForAgent;
  }

  /**
   * Verify that an agent role is authorized to execute a specific tool
   *
   * @param toolName - Name of the tool to check authorization for
   * @param agentRole - Agent role attempting to execute the tool
   * @returns true if authorized, false otherwise
   */
  isToolAuthorizedForRole(toolName: string, agentRole: AgentRole): boolean {
    const allowedRoles = this.toolRoleAccess.get(toolName);
    if (!allowedRoles) {
      return false;
    }
    return allowedRoles.includes(agentRole);
  }

  /**
   * Get the allowed roles for a specific tool
   *
   * @param toolName - Name of the tool
   * @returns Array of allowed agent roles for the tool
   * @throws NotFoundException if tool does not exist
   */
  getToolRoles(toolName: string): AgentRole[] {
    const roles = this.toolRoleAccess.get(toolName);
    if (!roles) {
      throw new NotFoundException(`Tool '${toolName}' not found in registry`);
    }
    return roles;
  }

  /**
   * Get all registered tools
   *
   * @returns Array of all tool definitions in the registry
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get count of registered tools
   *
   * @returns Number of tools in the registry
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Initialize default tools for agent roles
   *
   * Sets up standard tools available to different agent roles.
   * These are the core tools used by agents throughout the platform.
   */
  private initializeDefaultTools(): void {
    // write_file tool - for Dev agents
    this.registerTool(
      {
        name: 'write_file',
        description: 'Write or update content to a file in the project',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative file path from project root',
            },
            content: {
              type: 'string',
              description: 'File content to write',
            },
          },
          required: ['path', 'content'],
        },
        requiresSandbox: true,
        timeout: 10000,
        resourceLimits: {
          maxMemoryMB: 256,
          maxCPUPercent: 30,
          maxDiskMB: 100,
        },
      },
      [AgentRole.DEV]
    );

    // read_file tool - for Dev and QA agents
    this.registerTool(
      {
        name: 'read_file',
        description: 'Read content from a file in the project',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative file path from project root',
            },
          },
          required: ['path'],
        },
        requiresSandbox: true,
        timeout: 5000,
        resourceLimits: {
          maxMemoryMB: 256,
          maxCPUPercent: 20,
          maxDiskMB: 50,
        },
      },
      [AgentRole.DEV, AgentRole.QA]
    );

    // run_tests tool - for Dev and QA agents
    this.registerTool(
      {
        name: 'run_tests',
        description: 'Execute test suite for the project',
        parameters: {
          type: 'object',
          properties: {
            testPattern: {
              type: 'string',
              description: 'Pattern to match test files (optional)',
            },
            coverage: {
              type: 'boolean',
              description: 'Whether to generate coverage report',
            },
          },
          required: [],
        },
        requiresSandbox: true,
        timeout: 60000,
        resourceLimits: {
          maxMemoryMB: 1024,
          maxCPUPercent: 80,
          maxDiskMB: 500,
        },
      },
      [AgentRole.DEV, AgentRole.QA]
    );

    // create_milestone tool - for CEO and PM agents
    this.registerTool(
      {
        name: 'create_milestone',
        description: 'Create a new milestone for the project',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Milestone name',
            },
            description: {
              type: 'string',
              description: 'Milestone description',
            },
            dueDate: {
              type: 'string',
              description: 'ISO format due date (optional)',
            },
          },
          required: ['name', 'description'],
        },
        requiresSandbox: false,
        timeout: 5000,
      },
      [AgentRole.CEO, AgentRole.PM]
    );

    // create_task tool - for PM agent
    this.registerTool(
      {
        name: 'create_task',
        description: 'Create a new task for a milestone',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            milestoneId: {
              type: 'string',
              description: 'Milestone ID to assign task to',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority level',
            },
          },
          required: ['title', 'description'],
        },
        requiresSandbox: false,
        timeout: 5000,
      },
      [AgentRole.PM]
    );

    // send_message tool - for all agents
    this.registerTool(
      {
        name: 'send_message',
        description: 'Send a message to other agents or the team',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message content',
            },
            toRole: {
              type: 'string',
              description:
                'Recipient agent role or "all" for broadcast (optional)',
            },
            messageType: {
              type: 'string',
              enum: ['chat', 'thinking', 'action', 'notification'],
              description: 'Type of message',
            },
          },
          required: ['message'],
        },
        requiresSandbox: false,
        timeout: 5000,
      },
      [
        AgentRole.CEO,
        AgentRole.PM,
        AgentRole.DEV,
        AgentRole.QA,
        AgentRole.MARKETING,
      ]
    );

    // draft_content tool - for Marketing agent
    this.registerTool(
      {
        name: 'draft_content',
        description: 'Draft marketing or announcement content',
        parameters: {
          type: 'object',
          properties: {
            contentType: {
              type: 'string',
              enum: ['announcement', 'blog_post', 'email', 'social_media'],
              description: 'Type of content to draft',
            },
            topic: {
              type: 'string',
              description: 'Main topic or feature to write about',
            },
            targetAudience: {
              type: 'string',
              description: 'Target audience for the content',
            },
          },
          required: ['contentType', 'topic'],
        },
        requiresSandbox: false,
        timeout: 10000,
      },
      [AgentRole.MARKETING]
    );
  }
}
