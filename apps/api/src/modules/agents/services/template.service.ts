import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templateDir: string;

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
  }

  async loadTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const templatePath = path.join(this.templateDir, name);
    this.logger.debug(`Loading template from ${templatePath}`);

    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      const compiled = Handlebars.compile(content);
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
}
