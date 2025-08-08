# Database Setup Guide

The memory storage feature requires the database tables to be created in your Supabase project.

## Quick Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `supabase/migrations/20240801_create_memories_table.sql`
4. Click "Run" to execute the migration

## Alternative: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link your project
supabase link --project-ref uvdmmipuiqrjhjqwobnj

# Run migrations
supabase db push
```

## Verify Setup

After running the migration, test the database connection:

```bash
curl http://localhost:3000/api/test-db
```

You should see a success response with `"database": "Connected"` and `"tablesExist": true`.

## Troubleshooting

1. **pgvector not enabled**: 
   - Go to Database > Extensions in Supabase dashboard
   - Search for "vector" and enable it

2. **Permission errors**:
   - Make sure you're using the service role key (not anon key) in SUPABASE_SERVICE_ROLE_KEY

3. **Connection errors**:
   - Verify your Supabase URL is correct
   - Check that your API keys are valid