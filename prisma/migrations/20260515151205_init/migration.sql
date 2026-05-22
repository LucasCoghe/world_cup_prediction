-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MatchPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "advancingTeam" TEXT,
    CONSTRAINT "MatchPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtraPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topScorer" TEXT NOT NULL DEFAULT '',
    "belgianTopScorer" TEXT NOT NULL DEFAULT '',
    "worldChampion" TEXT NOT NULL DEFAULT '',
    "topScorerGoals" INTEGER NOT NULL DEFAULT 0,
    "topScorerFirstGoalMin" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExtraPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActualResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchNumber" INTEGER NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "advancingTeam" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPrediction_userId_matchNumber_key" ON "MatchPrediction"("userId", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraPrediction_userId_key" ON "ExtraPrediction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActualResult_matchNumber_key" ON "ActualResult"("matchNumber");
