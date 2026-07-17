const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Rename 'users' to 'User'
schema = schema.replace(/model users \{/g, 'model User {\n  @@map("users")');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+users(\s*@relation)/g, '$1 User$2');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+users\?(\s*@relation)/g, '$1 User?$2');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+users\[\]/g, '$1 User[]');

// Rename 'sessions' to 'SupabaseSession' for auth schema sessions
schema = schema.replace(/model sessions \{/g, 'model SupabaseSession {\n  @@map("sessions")');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+sessions(\s*@relation)/g, '$1 SupabaseSession$2');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+sessions\?(\s*@relation)/g, '$1 SupabaseSession?$2');
schema = schema.replace(/([a-zA-Z0-9_]+)\s+sessions\[\]/g, '$1 SupabaseSession[]');

// NextAuth User fields
// Rename email_confirmed_at to emailVerified @map("email_confirmed_at")
schema = schema.replace(/email_confirmed_at\s+DateTime\?\s+@db\.Timestamptz\(6\)/g, 
  'emailVerified DateTime? @map("email_confirmed_at") @db.Timestamptz(6)');

// Add accounts, sessions to User model
schema = schema.replace(/emailVerified\s+DateTime\?\s+@map\("email_confirmed_at"\)\s+@db\.Timestamptz\(6\)/g, 
  'emailVerified DateTime? @map("email_confirmed_at") @db.Timestamptz(6)\n  accounts Account[]\n  nextauth_sessions Session[]');

const nextAuthModels = `
// --- NextAuth Models ---

model Account {
  id                 String  @id @default(cuid())
  userId             String  @db.Uuid
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?  @db.Text
  access_token       String?  @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?  @db.Text
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@schema("public")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String   @db.Uuid
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@schema("public")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@schema("public")
}
`;

fs.writeFileSync('prisma/schema.prisma', schema + nextAuthModels);
console.log('Schema fixed and NextAuth models added!');
