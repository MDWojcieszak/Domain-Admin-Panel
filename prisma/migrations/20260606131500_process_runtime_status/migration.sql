-- AlterTable
ALTER TABLE "ServerCommand" DROP COLUMN "runtimeStatus",
DROP COLUMN "runningProgress";

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "runtimeStatus" "CommandRuntimeStatus" NOT NULL DEFAULT 'IDLE';
