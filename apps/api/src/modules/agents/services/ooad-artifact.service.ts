import { Injectable, Logger } from '@nestjs/common';
import { TemplateService } from './template.service';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import {
  Architecture,
  DomainModel,
  PatternItem,
  SequenceDiagram,
  UseCaseData,
  UseCaseItem,
} from '../schemas/ooad.schema';
import {
  buildClassDiagramView,
  buildSequenceView,
  buildSkeletonFiles,
  buildUseCaseView,
} from './ooad-view-model';

export interface GeneratedFile {
  /** Path relative to the generated project's root (projects/<projectId>) */
  path: string;
  content: string;
}

export interface DesignInput {
  projectName?: string;
  useCases: UseCaseItem[];
  domainModel: DomainModel;
  architecture: Architecture;
  patterns: PatternItem[];
  sequences: { useCase: UseCaseItem; diagram: SequenceDiagram }[];
}

/**
 * Facade over the OOAD templates: renders every design artifact and the layered code
 * skeleton for a generated project, and writes them to the sandbox. BA, Architect and
 * Dev strategies go through this service so the artifacts always share one format.
 */
@Injectable()
export class OOADArtifactService {
  private readonly logger = new Logger(OOADArtifactService.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly sandboxExecutor: SandboxExecutor
  ) {}

  static projectRoot(projectId: string): string {
    return `projects/${projectId}`;
  }

  /** BA output: docs/use-cases.md and docs/use-case-diagram.puml */
  async renderUseCaseArtifacts(data: UseCaseData, projectName?: string): Promise<GeneratedFile[]> {
    const view = buildUseCaseView(data, projectName || 'System');
    return [
      { path: 'docs/use-cases.md', content: await this.templateService.render('use-case-template.md', view) },
      { path: 'docs/use-case-diagram.puml', content: await this.templateService.render('use-case-diagram.puml', view) },
    ];
  }

  /** Architect output: domain model, class diagram, sequence diagrams and architecture doc */
  async renderDesignArtifacts(input: DesignInput): Promise<GeneratedFile[]> {
    const projectName = input.projectName || 'System';
    const files: GeneratedFile[] = [
      {
        path: 'docs/domain-model.puml',
        content: await this.templateService.render('domain-model-template.puml', input.domainModel),
      },
      {
        path: 'docs/class-diagram.puml',
        content: await this.templateService.render(
          'class-diagram.puml',
          buildClassDiagramView(input.domainModel, input.useCases, projectName)
        ),
      },
      {
        path: 'docs/architecture-patterns.md',
        content: await this.templateService.render('architecture-patterns-template.md', {
          architecture: input.architecture,
          patterns: input.patterns,
        }),
      },
    ];

    for (const seq of input.sequences) {
      files.push({
        path: `docs/sequence-${seq.useCase.id}.puml`,
        content: await this.templateService.render('sequence-diagram.puml', buildSequenceView(seq.useCase, seq.diagram)),
      });
    }
    return files;
  }

  /** Layered code skeleton (domain / application / infrastructure / presentation) */
  async renderSkeleton(input: Omit<DesignInput, 'sequences'>): Promise<GeneratedFile[]> {
    const specs = buildSkeletonFiles(
      input.domainModel,
      input.useCases,
      input.architecture,
      input.patterns,
      input.projectName
    );
    const files: GeneratedFile[] = [];
    for (const spec of specs) {
      files.push({ path: spec.path, content: await this.templateService.render(spec.template, spec.data) });
    }
    return files;
  }

  /** Write files under projects/<projectId>/ in the sandbox; returns the full paths written */
  async writeFiles(projectId: string, files: GeneratedFile[]): Promise<string[]> {
    const root = OOADArtifactService.projectRoot(projectId);
    const written: string[] = [];
    for (const file of files) {
      const fullPath = `${root}/${file.path}`;
      const command = `mkdir -p "$(dirname "${fullPath}")" && cat > "${fullPath}" << 'HEREDOC_EOF'\n${file.content}\nHEREDOC_EOF`;
      await this.sandboxExecutor.executeInSandbox('custom_command', command, {
        maxMemoryMB: 128,
        maxCPUPercent: 20,
        maxDiskMB: 50,
        timeout: 10000,
      });
      written.push(fullPath);
    }
    this.logger.log(`Wrote ${written.length} OOAD file(s) under ${root}`);
    return written;
  }

  /**
   * Rebuild the design context for the Dev agent from the persisted ooadMetadata
   * (the database is the source of truth; sandbox files don't outlive their container).
   * Returns null when BA/Architect haven't produced a design yet.
   */
  async buildImplementationContext(metadata: any, projectName?: string): Promise<string | null> {
    if (!metadata?.useCases?.length || !metadata?.domainModel || !metadata?.architecture) {
      return null;
    }

    const input = {
      projectName,
      useCases: metadata.useCases as UseCaseItem[],
      domainModel: metadata.domainModel as DomainModel,
      architecture: metadata.architecture as Architecture,
      patterns: (metadata.patterns || []) as PatternItem[],
    };
    const [useCasesMd] = await this.renderUseCaseArtifacts(
      { actors: metadata.actors || [], useCases: input.useCases },
      projectName
    );
    const design = await this.renderDesignArtifacts({ ...input, sequences: [] });
    const skeleton = await this.renderSkeleton(input);
    const doc = (p: string) => design.find(f => f.path === p)?.content || '';

    return [
      '==== OOAD DESIGN (MUST FOLLOW) ====',
      `=== USE CASES ===\n${useCasesMd.content}`,
      `=== DOMAIN MODEL ===\n${doc('docs/domain-model.puml')}`,
      `=== CLASS DIAGRAM ===\n${doc('docs/class-diagram.puml')}`,
      `=== ARCHITECTURE & PATTERNS ===\n${doc('docs/architecture-patterns.md')}`,
      `=== CODE SKELETON (already generated, fill in the TODOs) ===\n${skeleton.map(f => `- ${f.path}`).join('\n')}`,
      [
        '==== IMPLEMENTATION RULES ====',
        '1. Keep the layered structure of the skeleton: src/domain, src/application, src/infrastructure, src/presentation',
        '2. Dependencies point inwards only; src/domain must not import from other layers',
        '3. Implement entities EXACTLY as specified in the domain model and class diagram',
        '4. Put each use case in its application service method and keep its comment (e.g. // UC-001: Create Order)',
        '5. Apply the design patterns listed above and follow SOLID principles',
        '6. Use the skeleton file paths when you rewrite a file; add new files to the matching layer folder',
        '7. Name tests after the use case they cover, e.g. describe(\'UC-001: ...\')',
      ].join('\n'),
    ].join('\n\n');
  }
}
