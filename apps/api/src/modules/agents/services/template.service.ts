import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { toCamelCase, toKebabCase, toPascalCase, toPumlId } from './ooad-view-model';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templateDir: string;
  // Isolated Handlebars instance so helpers don't leak into other users of the library
  private readonly handlebars = Handlebars.create();

  constructor() {
    // Use environment variable or fallback to build output location
    const customPath = process.env.OOAD_TEMPLATES_PATH;
    if (customPath) {
      this.templateDir = path.resolve(customPath);
      this.logger.log(`Using custom template path: ${this.templateDir}`);
    } else {
      // Default: relative to this file's location
      this.templateDir = path.join(__dirname, '../templates/ooad');
      this.logger.log(`Using default template path: ${this.templateDir}`);
    }

    this.registerHelpers();
  }

  async loadTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const templatePath = path.join(this.templateDir, name);
    this.logger.debug(`Loading template from ${templatePath}`);

    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      // Templates emit Markdown, PlantUML and TypeScript, never HTML: escaping would turn
      // "<|--" into "&lt;|--" and "Promise<T>" into "Promise&lt;T&gt;"
      const compiled = this.handlebars.compile(content, { noEscape: true });
      this.templateCache.set(name, compiled);
      return compiled;
    } catch (error: any) {
      this.logger.error(`Failed to load template ${name}: ${error.message}`);
      throw new Error(`Template not found: ${name}`);
    }
  }

  async render(templateName: string, data: any): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return template(data);
  }

  clearCache(): void {
    this.templateCache.clear();
    this.logger.debug('Template cache cleared');
  }

  private registerHelpers(): void {
    this.handlebars.registerHelper('pascalCase', (value: string) => toPascalCase(String(value ?? '')));
    this.handlebars.registerHelper('camelCase', (value: string) => toCamelCase(String(value ?? '')));
    this.handlebars.registerHelper('kebabCase', (value: string) => toKebabCase(String(value ?? '')));
    this.handlebars.registerHelper('pumlId', (value: string) => toPumlId(String(value ?? '')));
    this.handlebars.registerHelper('inc', (value: number) => Number(value) + 1);
    this.handlebars.registerHelper('join', (items: unknown[], separator: unknown) =>
      Array.isArray(items) ? items.join(typeof separator === 'string' ? separator : ', ') : ''
    );
  }
}
