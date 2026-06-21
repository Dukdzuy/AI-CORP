-- Enable pgvector extension for vector similarity search
-- This extension is required for semantic memory search functionality
CREATE EXTENSION IF NOT EXISTS vector;

-- The ivfflat index will be created by Prisma migrations
-- This is just a reference note for the pgvector setup
