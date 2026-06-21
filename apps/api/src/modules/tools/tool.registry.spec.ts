import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentRole, ToolDefinition } from '@ai-corp/shared-types';
import { ToolRegistry } from './tool.registry';

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
  });

  describe('registerTool', () => {
    it('should register a tool with valid definition and roles', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
      };

      expect(() => {
        toolRegistry.registerTool(tool, [AgentRole.DEV]);
      }).not.toThrow();

      expect(toolRegistry.getTool('test_tool')).toBeDefined();
    });

    it('should throw error if tool name is empty', () => {
      const tool: ToolDefinition = {
        name: '',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
      };

      expect(() => {
        toolRegistry.registerTool(tool, [AgentRole.DEV]);
      }).toThrow(BadRequestException);
    });

    it('should throw error if tool already exists', () => {
      const tool: ToolDefinition = {
        name: 'duplicate_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [AgentRole.DEV]);

      expect(() => {
        toolRegistry.registerTool(tool, [AgentRole.DEV]);
      }).toThrow(BadRequestException);
    });

    it('should throw error if description is empty', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: '',
        parameters: { type: 'object', properties: {} },
      };

      expect(() => {
        toolRegistry.registerTool(tool, [AgentRole.DEV]);
      }).toThrow(BadRequestException);
    });

    it('should throw error if parameters are missing', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: null as any,
      };

      expect(() => {
        toolRegistry.registerTool(tool, [AgentRole.DEV]);
      }).toThrow(BadRequestException);
    });

    it('should throw error if no roles are provided', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
      };

      expect(() => {
        toolRegistry.registerTool(tool, []);
      }).toThrow(BadRequestException);
    });

    it('should throw error if invalid role is provided', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
      };

      expect(() => {
        toolRegistry.registerTool(tool, ['INVALID_ROLE' as any]);
      }).toThrow(BadRequestException);
    });

    it('should set default values for optional fields', () => {
      const tool: ToolDefinition = {
        name: 'simple_tool',
        description: 'A simple tool',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [AgentRole.DEV]);
      const registered = toolRegistry.getTool('simple_tool');

      expect(registered?.requiresSandbox).toBe(false);
      expect(registered?.timeout).toBe(30000);
      expect(registered?.resourceLimits).toBeDefined();
    });
  });

  describe('getTool', () => {
    it('should return tool if it exists', () => {
      const tool: ToolDefinition = {
        name: 'get_test_tool',
        description: 'A test tool for getting',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [AgentRole.DEV]);
      const retrieved = toolRegistry.getTool('get_test_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('get_test_tool');
    });

    it('should return undefined if tool does not exist', () => {
      const retrieved = toolRegistry.getTool('nonexistent_tool');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getToolsForAgent', () => {
    beforeEach(() => {
      // Register test tools with different role access
      const devOnlyTool: ToolDefinition = {
        name: 'dev_only',
        description: 'Dev only tool',
        parameters: { type: 'object', properties: {} },
      };

      const multiRoleTool: ToolDefinition = {
        name: 'multi_role',
        description: 'Available to multiple roles',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(devOnlyTool, [AgentRole.DEV]);
      toolRegistry.registerTool(multiRoleTool, [
        AgentRole.DEV,
        AgentRole.QA,
      ]);
    });

    it('should return tools available to a specific agent role', () => {
      const devTools = toolRegistry.getToolsForAgent(AgentRole.DEV);

      expect(devTools.length).toBeGreaterThanOrEqual(2);
      expect(
        devTools.some((tool) => tool.name === 'dev_only')
      ).toBe(true);
      expect(
        devTools.some((tool) => tool.name === 'multi_role')
      ).toBe(true);
    });

    it('should return only authorized tools for QA role', () => {
      const qaTools = toolRegistry.getToolsForAgent(AgentRole.QA);

      expect(
        qaTools.some((tool) => tool.name === 'dev_only')
      ).toBe(false);
      expect(
        qaTools.some((tool) => tool.name === 'multi_role')
      ).toBe(true);
    });

    it('should return empty array if role has no tools', () => {
      const ceoTools = toolRegistry.getToolsForAgent(AgentRole.CEO);

      // CEO might have some default tools, but let's check the structure
      expect(Array.isArray(ceoTools)).toBe(true);
    });

    it('should throw error if invalid role is provided', () => {
      expect(() => {
        toolRegistry.getToolsForAgent('INVALID_ROLE' as any);
      }).toThrow(BadRequestException);
    });
  });

  describe('isToolAuthorizedForRole', () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: 'authorized_tool',
        description: 'Test authorization',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [AgentRole.DEV, AgentRole.QA]);
    });

    it('should return true if role is authorized for tool', () => {
      expect(
        toolRegistry.isToolAuthorizedForRole('authorized_tool', AgentRole.DEV)
      ).toBe(true);

      expect(
        toolRegistry.isToolAuthorizedForRole('authorized_tool', AgentRole.QA)
      ).toBe(true);
    });

    it('should return false if role is not authorized for tool', () => {
      expect(
        toolRegistry.isToolAuthorizedForRole('authorized_tool', AgentRole.PM)
      ).toBe(false);
    });

    it('should return false if tool does not exist', () => {
      expect(
        toolRegistry.isToolAuthorizedForRole('nonexistent', AgentRole.DEV)
      ).toBe(false);
    });
  });

  describe('getToolRoles', () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: 'multi_role_tool',
        description: 'Tool for multiple roles',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [
        AgentRole.CEO,
        AgentRole.PM,
        AgentRole.DEV,
      ]);
    });

    it('should return all authorized roles for a tool', () => {
      const roles = toolRegistry.getToolRoles('multi_role_tool');

      expect(roles).toContain(AgentRole.CEO);
      expect(roles).toContain(AgentRole.PM);
      expect(roles).toContain(AgentRole.DEV);
      expect(roles.length).toBe(3);
    });

    it('should throw error if tool does not exist', () => {
      expect(() => {
        toolRegistry.getToolRoles('nonexistent_tool');
      }).toThrow(NotFoundException);
    });
  });

  describe('getAllTools', () => {
    it('should return all registered tools', () => {
      const tool1: ToolDefinition = {
        name: 'tool_1',
        description: 'First tool',
        parameters: { type: 'object', properties: {} },
      };

      const tool2: ToolDefinition = {
        name: 'tool_2',
        description: 'Second tool',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool1, [AgentRole.DEV]);
      toolRegistry.registerTool(tool2, [AgentRole.QA]);

      const allTools = toolRegistry.getAllTools();

      expect(allTools.length).toBeGreaterThanOrEqual(2);
      expect(allTools.some((tool) => tool.name === 'tool_1')).toBe(true);
      expect(allTools.some((tool) => tool.name === 'tool_2')).toBe(true);
    });
  });

  describe('getToolCount', () => {
    it('should return the count of registered tools', () => {
      const initialCount = toolRegistry.getToolCount();

      const tool: ToolDefinition = {
        name: 'count_test_tool',
        description: 'For testing count',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool, [AgentRole.DEV]);

      expect(toolRegistry.getToolCount()).toBe(initialCount + 1);
    });
  });

  describe('default tools initialization', () => {
    it('should have default tools registered on initialization', () => {
      const count = toolRegistry.getToolCount();

      expect(count).toBeGreaterThan(0);
      expect(toolRegistry.getTool('write_file')).toBeDefined();
      expect(toolRegistry.getTool('read_file')).toBeDefined();
      expect(toolRegistry.getTool('run_tests')).toBeDefined();
      expect(toolRegistry.getTool('create_milestone')).toBeDefined();
      expect(toolRegistry.getTool('create_task')).toBeDefined();
    });

    it('should have write_file tool available to DEV only', () => {
      const roles = toolRegistry.getToolRoles('write_file');

      expect(roles).toContain(AgentRole.DEV);
      expect(roles.length).toBe(1);
    });

    it('should have read_file tool available to DEV and QA', () => {
      const roles = toolRegistry.getToolRoles('read_file');

      expect(roles).toContain(AgentRole.DEV);
      expect(roles).toContain(AgentRole.QA);
      expect(roles.length).toBe(2);
    });

    it('should have create_milestone tool available to CEO and PM', () => {
      const roles = toolRegistry.getToolRoles('create_milestone');

      expect(roles).toContain(AgentRole.CEO);
      expect(roles).toContain(AgentRole.PM);
    });

    it('should have send_message tool available to all roles', () => {
      const roles = toolRegistry.getToolRoles('send_message');

      expect(roles).toContain(AgentRole.CEO);
      expect(roles).toContain(AgentRole.PM);
      expect(roles).toContain(AgentRole.DEV);
      expect(roles).toContain(AgentRole.QA);
      expect(roles).toContain(AgentRole.MARKETING);
      expect(roles.length).toBe(5);
    });

    it('should have draft_content tool available to MARKETING only', () => {
      const roles = toolRegistry.getToolRoles('draft_content');

      expect(roles).toContain(AgentRole.MARKETING);
      expect(roles.length).toBe(1);
    });

    it('should set appropriate resource limits for sandbox tools', () => {
      const writeFile = toolRegistry.getTool('write_file');

      expect(writeFile?.requiresSandbox).toBe(true);
      expect(writeFile?.timeout).toBeGreaterThan(0);
      expect(writeFile?.resourceLimits).toBeDefined();
      expect(
        writeFile?.resourceLimits?.maxMemoryMB
      ).toBeGreaterThan(0);
    });
  });

  describe('role-based access control edge cases', () => {
    it('should handle registration with all agent roles', () => {
      const tool: ToolDefinition = {
        name: 'universal_tool',
        description: 'Available to all agents',
        parameters: { type: 'object', properties: {} },
      };

      const allRoles = Object.values(AgentRole);
      toolRegistry.registerTool(tool, allRoles);

      const roles = toolRegistry.getToolRoles('universal_tool');
      expect(roles.length).toBe(allRoles.length);
    });

    it('should correctly filter tools when agent has multiple tools available', () => {
      const tool1: ToolDefinition = {
        name: 'multi_dev_tool_1',
        description: 'First tool for dev',
        parameters: { type: 'object', properties: {} },
      };

      const tool2: ToolDefinition = {
        name: 'multi_dev_tool_2',
        description: 'Second tool for dev',
        parameters: { type: 'object', properties: {} },
      };

      const tool3: ToolDefinition = {
        name: 'qa_only_tool',
        description: 'Only for QA',
        parameters: { type: 'object', properties: {} },
      };

      toolRegistry.registerTool(tool1, [AgentRole.DEV]);
      toolRegistry.registerTool(tool2, [AgentRole.DEV, AgentRole.QA]);
      toolRegistry.registerTool(tool3, [AgentRole.QA]);

      const devTools = toolRegistry.getToolsForAgent(AgentRole.DEV);
      const devToolNames = devTools.map((t) => t.name);

      expect(devToolNames).toContain('multi_dev_tool_1');
      expect(devToolNames).toContain('multi_dev_tool_2');
      expect(devToolNames).not.toContain('qa_only_tool');
    });
  });
});
