process.env["NODE_ENV"] = "test";
process.env["PORT"] = "3001";
process.env["FRONTEND_URL"] = "http://localhost:3000";
process.env["DATABASE_URL"] = process.env["DATABASE_URL"] || "postgresql://autoapply:secret@localhost:5432/autoapply_test";
process.env["REDIS_URL"] = process.env["REDIS_URL"] || "redis://localhost:6379";
process.env["JWT_SECRET"] = process.env["JWT_SECRET"] || "test-jwt-secret-min-32-chars-123456";
process.env["JWT_EXPIRES_IN"] = "7d";
process.env["ENCRYPTION_KEY"] = process.env["ENCRYPTION_KEY"] || "12345678901234567890123456789012";
process.env["AGENT_DEFAULT_SCHEDULE"] = "0 */2 * * *";
process.env["MAX_APPLICATIONS_PER_RUN"] = "20";
process.env["UPLOADS_DIR"] = "./uploads";
process.env["MAX_FILE_SIZE_MB"] = "10";
process.env["OPENAI_API_KEY"] = ""; // force heuristic codepaths in unit tests
process.env["OPENAI_MODEL"] = "gpt-4o";
process.env["FROM_EMAIL"] = "AutoApply <noreply@autoapply.dev>";

