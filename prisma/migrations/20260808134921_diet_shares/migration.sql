-- CreateTable
CREATE TABLE "DietShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dietId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DietShare_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "Diet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DietShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DietShare_userId_idx" ON "DietShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DietShare_dietId_userId_key" ON "DietShare"("dietId", "userId");
