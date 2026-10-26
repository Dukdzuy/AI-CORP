# Architecture & Design Patterns

## Architecture Style

**{{architecture.style}}**

## Layers

| Layer | Responsibilities | Components | Dependencies |
|-------|------------------|------------|--------------|
{{#each architecture.layers}}
| {{name}} | {{responsibilities}} | {{join components ", "}} | {{dependencies}} |
{{/each}}

**Dependency rule:** source code dependencies point inwards only
(Presentation → Application → Domain ← Infrastructure). The domain layer has no
framework or persistence imports; infrastructure implements the repository
interfaces declared in the domain.

## Design Patterns

{{#each patterns}}
### {{inc @index}}. {{name}} ({{type}})

- **Where:** `{{location}}`
- **Why:** {{justification}}
- **Benefit:** {{benefit}}

{{/each}}
## Design Artifacts

- `use-cases.md` and `use-case-diagram.puml`: requirements (BA)
- `domain-model.puml`: entities, value objects and relationships
- `class-diagram.puml`: classes per layer and their dependencies
- `sequence-UC-XXX.puml`: interactions for the high-priority use cases
- `../ARCHITECTURE.md` and `../src/`: the layered code skeleton to implement
