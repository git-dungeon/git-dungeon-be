-- CreateTable
CREATE TABLE "GithubSyncState" (
    "userId" UUID NOT NULL,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastManualSuccessfulSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubSyncState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "GithubSyncState" ADD CONSTRAINT "GithubSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
