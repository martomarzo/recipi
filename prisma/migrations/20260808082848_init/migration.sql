-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "usedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IngredientCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "emoji" TEXT,
    "imagePath" TEXT,
    "kcal100" REAL NOT NULL,
    "protein100" REAL NOT NULL,
    "carbs100" REAL NOT NULL,
    "fat100" REAL NOT NULL,
    "fiber100" REAL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ingredient_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dietId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "startOffsetDays" INTEGER NOT NULL,
    "durationDays" INTEGER,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "dailyRulesMd" TEXT,
    CONSTRAINT "Phase_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "Diet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReintroBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 4,
    "tipsMd" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "statusNote" TEXT,
    CONSTRAINT "ReintroBlock_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReintroBlockIngredient" (
    "blockId" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,

    PRIMARY KEY ("blockId", "ingredientId"),
    CONSTRAINT "ReintroBlockIngredient_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ReintroBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReintroBlockIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhaseIngredientRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "ingredientId" INTEGER,
    "categoryId" INTEGER,
    "rule" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "PhaseIngredientRule_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhaseIngredientRule_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhaseIngredientRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealType" TEXT NOT NULL,
    "recipeMd" TEXT,
    "sourceUrl" TEXT,
    "rawText" TEXT,
    "parsedJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    CONSTRAINT "Dish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DishIngredient" (
    "dishId" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "grams" REAL NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("dishId", "ingredientId"),
    CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DishIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DishSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dishId" TEXT NOT NULL,
    "dietId" TEXT,
    "phaseId" TEXT,
    "blockId" TEXT,
    "weekNumber" INTEGER,
    CONSTRAINT "DishSuggestion_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DishSuggestion_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "Diet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DishSuggestion_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DishSuggestion_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ReintroBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dietId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "noteMd" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEntry_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "Diet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientCategory_key_key" ON "IngredientCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_key_key" ON "Ingredient"("key");

-- CreateIndex
CREATE INDEX "Diet_userId_idx" ON "Diet"("userId");

-- CreateIndex
CREATE INDEX "Phase_dietId_idx" ON "Phase"("dietId");

-- CreateIndex
CREATE INDEX "ReintroBlock_phaseId_idx" ON "ReintroBlock"("phaseId");

-- CreateIndex
CREATE INDEX "PhaseIngredientRule_phaseId_idx" ON "PhaseIngredientRule"("phaseId");

-- CreateIndex
CREATE INDEX "DishSuggestion_dietId_idx" ON "DishSuggestion"("dietId");

-- CreateIndex
CREATE INDEX "DishSuggestion_dishId_idx" ON "DishSuggestion"("dishId");

-- CreateIndex
CREATE INDEX "TrackingEntry_dietId_date_idx" ON "TrackingEntry"("dietId", "date");
