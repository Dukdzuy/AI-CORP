# Use Case Specification: {{projectName}}

## Actors

{{#each actors}}
- {{name}}
{{/each}}

## Use Case Summary

| ID | Name | Actor | Priority |
|----|------|-------|----------|
{{#each useCases}}
| {{id}} | {{name}} | {{actor}} | {{priority}} |
{{/each}}

See `use-case-diagram.puml` for the diagram.

{{#each useCases}}
---

## Use Case: {{name}}

| Field | Value |
|-------|-------|
| **ID** | {{id}} |
| **Priority** | {{priority}} |
| **Primary Actor** | {{actor}} |

### Preconditions

{{#each preConditions}}
- {{this}}
{{/each}}

### Main Flow

{{#each mainFlow}}
{{inc @index}}. {{this}}
{{/each}}

### Alternative Flows

{{#each alternativeFlows}}
- {{this}}
{{/each}}

### Exception Flows

{{#each exceptionFlows}}
- {{this}}
{{/each}}

### Postconditions

{{#each postConditions}}
- {{this}}
{{/each}}

{{/each}}
