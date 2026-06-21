# Task 3.3: Create Prisma Schema for LLM Gateway and Logging - COMPLETED

## Summary

Successfully created and enhanced the Prisma schema for LLM gateway integration and logging, including `ApiUsageLog` and `LLMGatewayStatus` models with comprehensive validation constraints and documentation.

## Changes Made

### 1. ApiUsageLog Model
Enhanced with comprehensive field documentation and validation constraints:

```prisma
model ApiUsageLog {
  id                  String    @id @default(uuid())
  projectId           String?   // Optional reference to project
  agentRole           String    // Agent that made the LLM request
  requestedModel      String    // Model requested by agent
  actualModelUsed     String    // Actual model returned by provider (used for cost calculation)
  actualProvider      String    // Provider that handled the request (9Router, Anthropic, etc.)
  isFallbackTriggered Boolean   @default(false) // Whether circuit breaker fallback was used
  promptTokens        Int       // Token count for prompt/input
  completionTokens    Int       // Token count for completion/output
  totalTokens         Int       // VALIDATION: Must equal promptTokens + completionTokens
  rtkTokenSaved       Int?      // VALIDATION: Non-negative and <= promptTokens
  estimatedCost       Decimal   @db.Decimal(10, 6) // Cost from requestedModel pricing
  actualCost          Decimal   @db.Decimal(10, 6) // Cost from actualModelUsed pricing
  responseTimeMs      Int       // LLM response latency in milliseconds
  createdAt           DateTime  @default(now())
  
  project             Project?  @relation(fields: [projectId], references: [id])
  
  @@index([projectId, createdAt])   // For cost tracking and analytics
  @@index([agentRole, createdAt])   // For per-agent cost analysis
}
```

**Key Features:**
- Tracks both requested and actual models for fallback analysis
- Separates estimated cost (from requested model) vs actual cost (from actual model)
- Stores RTK token compression savings (when 9Router is used)
- Maintains project relationship for budget tracking
- Includes response time metrics for performance monitoring
- Indexed on projectId and agentRole for efficient queries

**Validation Rules (App Layer):**
- `totalTokens = promptTokens + completionTokens`
- `rtkTokenSaved >= 0 and rtkTokenSaved <= promptTokens`
- `estimatedCost and actualCost must be calculated correctly from pricing tables`

### 2. LLMGatewayStatus Model
Enhanced with circuit breaker and health monitoring capabilities:

```prisma
model LLMGatewayStatus {
  id                  String    @id @default(uuid())
  gatewayName         String    @unique // "ninerouter" - identifies the gateway
  status              String    // "online", "offline", "degraded" - current health status
  lastHealthCheck     DateTime  // Timestamp of last health check
  consecutiveFailures Int       @default(0) // Triggers circuit breaker at threshold 3
  metadata            Json?     // Additional health metrics (error details, latency, etc.)
  updatedAt           DateTime  @updatedAt // Last status update timestamp
}
```

**Key Features:**
- Unique constraint on gatewayName ensures one record per gateway
- Tracks consecutive failures for circuit breaker logic
- Stores health check timestamp for monitoring intervals
- Stores health status (online/offline/degraded)
- Metadata field can contain detailed error information and metrics
- Automatically updated timestamp for status changes

**Validation Rules (App Layer):**
- `consecutiveFailures >= 0`
- Circuit breaker opens when `consecutiveFailures >= 3`
- Circuit breaker closes when health check succeeds after failures

## Requirements Mapping

### Requirement 4: LLM Gateway Integration
✅ ApiUsageLog logs actual model used, token counts, and calculated cost
✅ Captures actual model and provider name for cost accuracy
✅ Records when fallback is triggered via `isFallbackTriggered` flag
✅ Stores RTK token savings in `rtkTokenSaved` field

### Requirement 5: Circuit Breaker Pattern
✅ LLMGatewayStatus tracks consecutive failures
✅ Circuit breaker logic references `consecutiveFailures` counter
✅ Status field indicates circuit state (online/offline/degraded)
✅ Metadata field can store detailed circuit breaker information

### Requirement 11: Cost Tracking and Budget Management
✅ ApiUsageLog separates estimated vs actual costs
✅ Actual cost calculated from actual model pricing (not requested model)
✅ Records fallback trigger status
✅ Records RTK token savings

### Requirement 20: Logging and Observability
✅ ApiUsageLog logs requested model, actual model, provider, token usage, cost
✅ LLMGatewayStatus logs circuit breaker state changes
✅ Response time tracking for performance monitoring
✅ Indexed on agentRole for per-agent analytics

## Database Design Details

### Performance Optimizations
- **ProjectId + CreatedAt Index**: Enables efficient queries for cost tracking and analytics over time
- **AgentRole + CreatedAt Index**: Enables per-agent cost analysis and filtering
- **Unique Constraint on LLMGatewayStatus.gatewayName**: Prevents duplicate gateway records

### Data Relationships
- ApiUsageLog maintains optional reference to Project for budget tracking
- LLMGatewayStatus is standalone (no direct relationships) - referenced by LLM gateway service

### Validation Strategy
Since Prisma schema doesn't support CHECK constraints, validation is enforced at the application layer:
- NestJS service validates token counts and RTK savings before insertion
- Service enforces pricing calculations for estimated vs actual costs
- Database constraints are documented in field comments for developer reference

## Implementation Notes

1. **Validation Layer**: Application code must validate:
   - `totalTokens = promptTokens + completionTokens` before saving
   - `rtkTokenSaved` is non-negative and not greater than promptTokens
   - Cost calculations use correct pricing for actual model (not requested model)

2. **Circuit Breaker Service**: Should use LLMGatewayStatus to:
   - Increment consecutiveFailures on provider failure
   - Reset to 0 on successful health check
   - Update status field to reflect online/offline/degraded state
   - Store health check details in metadata field

3. **Cost Tracking Service**: Should use ApiUsageLog to:
   - Query by projectId for project budget tracking
   - Query by agentRole for analytics and reporting
   - Calculate accumulated costs for budget warnings
   - Track RTK savings and fallback impact on costs

## Files Modified

- `e:\AI CORP\apps\api\prisma\schema.prisma` - Added comprehensive comments and validation rule documentation to ApiUsageLog and LLMGatewayStatus models

## Next Steps

These models are now ready for:
1. Database migration generation (`prisma migrate dev`)
2. Service implementation in NestJS modules
3. Integration with LLM Gateway and cost tracking services
4. Frontend dashboard for cost analytics

